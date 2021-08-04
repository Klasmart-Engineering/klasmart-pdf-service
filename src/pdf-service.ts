import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import * as imageConverter from './image-converter';
import * as s3Service from './s3-client';
import NodeCache from 'node-cache';
import createError, { HttpError } from 'http-errors';
import { Readable } from 'stream';
import { withLogger } from './logger';
import fs from 'fs';
import { JPEGStream } from 'canvas';
import crypto from 'crypto';
import createHttpError from 'http-errors';

const log = withLogger('pdf-service');

let pageResolutionCache: NodeCache;
const defaultCacheProps = {
    stdTTL: 100,
    checkperiod: 60
}

/**
 * Provides configuration for the PDF service
 * @param cache - Provided NodeCache. Will use a default configuration if not provided
 */
export const initialize = (cache: NodeCache = new NodeCache(defaultCacheProps)): void => {
    pageResolutionCache = cache;
}

export const validatePDFTextContent = async (pdfName: string) : Promise<{ valid: boolean, pages?: number }> => {
    return imageConverter.validatePDFTextContent(`${process.env.CMS_BASE_URL}/assets/${pdfName}`);
}

export const getPDFPages = async (pdfURL: URL):Promise<number> => {
    let existingMetadata;
    try {
        const em = getManager();
        log.debug('Checking for existing metadata');
        existingMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
    } catch (err) {
        log.error(`Error while attempting to retrieve metadata from the database: ${err.message}`);
        throw createError(500, err.message, err);
    }
        
    if (existingMetadata) return existingMetadata.totalPages;

    log.debug('No pre-existing metadata found. Initializing');
    const { pdfMetadata } = await initializeMetadata(pdfURL);

    return pdfMetadata.totalPages;
}

/**
 * Function to generate and store images from a PDF - intended to be used to hook into the 
 * CMS upload process to pre-generate images
 * @param pdfName 
 * @param pdfURL 
 */
export const generateAndStorgePageImages = async (pdfName: string, pdfURL: URL): Promise<void> => {
    const pages = await getPDFPages(pdfURL);

    for(let i = 1; i <= pages; i++) {
        try {
            await getPDFPage(pdfName, i, pdfURL);
        } catch (err) {
            log.error(err.message);
            console.error(err);
        }
    }
} 

/* Produces the page key for the pdf, then attempts to load it from s3.
    If the object is not in S3, then the application will check the page cache. If the pageKey is found in the cache, 
    then it will await page creation and then read the page image.
    If the pageKey is not in the cache it will add it to the cache and then load the PDF, generate an image for the page and save it to S3,
        then return a stream for this image
*/
export const getPDFPage = async (pdfName: string, page: number, pdfURL: URL): Promise<Readable> => {
    const pageKey = mapPageKey(pdfURL, pdfName, page);
    let pageStream: Readable | undefined;
    
    try {
        pageStream = await s3Service.readObject(pageKey);
    } catch (err) {
        // 404/403 errors are expected here, so don't rethrow these
        if (!(err instanceof HttpError)) {
            // We can probably continue here, this error may indicate a problem but won't prevent us from trying other things
            log.warn(`Unexpected error in initial S3 request: ${err.message}`)
        } else if (![403, 404].includes(err.status)) {
            throw err;
        }
    }

    if (pageStream) return pageStream;
    
    if (pageResolutionCache.has(pageKey)) {
        log.debug('Page key found in cache, awaiting resolution if not already resolved');
        await pageResolutionCache.get(pageKey);
        log.debug('Resolved, page is prerendered');
        const stream = await s3Service.readObject(pageKey);
        if (stream) return stream;
    }

    let stream;
    try {
        const tempFilename = await renderSinglePage(pageKey, pdfURL, page);
        // stream = await s3Service.readObject(pageKey);
        stream = fs.createReadStream(tempFilename);
        stream.on('close', () => {
            log.debug(`Removing temporary file: ${tempFilename}`);
            fs.promises.rm(tempFilename)
        });
    } catch (err) {
        log.error(`Error rendering PDF page: ${err.message}`)
        if (err instanceof HttpError) throw err;

        // Delete key, as data may not actually be available due to error
        pageResolutionCache.del(pageKey);
        throw createError(500, err.message);
    } 
    if (!stream) throw createHttpError(500, 'Unable to retrieve object after write.');
    return stream;
}

export const getDirectPageRender = async (page: number, pdfURL: URL): Promise<JPEGStream> => {
    const document = await imageConverter.createDocumentFromStream(pdfURL.toString());
    return imageConverter.generatePageImage(document, page);
}

const renderSinglePage = async (pageKey: string, pdfURL: URL, page: number): Promise<string> => {
    // Async code invoked via IIFE to allow immediate access of the promise to the cache
    const promise = (async () => {
        const em = getManager();
        const pdfMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
        if (!pdfMetadata) throw createError(400, `PDF metadata not found. PDF must be processed using '.../pages?...' before pages can be loaded.`);
        
        if (pdfMetadata.totalPages < page) {
            throw createError(404, `Document does not contain page: ${page}`)
        }
        
        const document = await imageConverter.createDocumentFromStream(pdfURL.toString());

        const jpegStream = await imageConverter.generatePageImage(document, page);

        const randPrefix = Buffer.from(crypto.randomBytes(16)).toString('hex');
        const filename = `./${randPrefix}-${pageKey.replace('/', '-')}`;
        let contentLength: number;
        let stat;
        try {
            contentLength = await writeStreamToTempFile(filename, jpegStream);
            log.debug(`Bytes written for ${pageKey}: ${contentLength}`);
            stat = await fs.promises.stat(filename);
            log.debug(`Filesize for ${pageKey}: ${stat.size}`);
        } catch (err) {
            log.error(`Error writing image to temporary file: ${err.message}`);
            throw createError(500, err.message);
        }

        log.info('Reading temp file from file system');
        fs.createReadStream(filename).pipe(
            fs.createWriteStream(`rewrite-${filename}`)
        );

        const readStream = fs.createReadStream(filename);

        log.info('Sending data to S3');
        
        try {
            await s3Service.uploadObject(pageKey, readStream);
        } catch (err) {
            // ! Note: HttpErrors will be propagated, but any other error types will only be
            // ! logged, as the requested image can still be successfully served from the temp
            // ! file. While it would be better to persist the image, failing to do so will not
            // ! prevent us from succcessfully serving the image to the user.
            if (err instanceof HttpError) throw err;
            log.error(`Error writing file to S3.`);
            log.error(JSON.stringify(err));
        }
        return filename;
    })();
    pageResolutionCache.set(pageKey, promise);

    return promise;
}

const writeStreamToTempFile = (filename: string, stream: JPEGStream): Promise<number> => {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filename);
        stream
            .on('end', async () => {
                log.debug(`stream end`);
                const contentLength = fileStream.bytesWritten;
                log.silly(`contentLength: ${contentLength}`)
                resolve(contentLength);
            })
            .on('error', (err) => {
                log.error(`Error reading from JPEGStream while streaming to temporary file: ${err.message}`)
                reject(err);
            })
            .pipe(fileStream)
            .on('error', (err) => {
                log.error(`Error raised by WriteFileStream while streaming to temporary file: ${err.message}`)
                reject(err);
            });

        log.debug('Piping file');
    });
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
const initializeMetadata = async (pdfURL: URL) => {
    log.debug(`Creating document for pdf located at ${pdfURL.toString()}`); 
    try {
        const document = await imageConverter.createDocumentFromStream(pdfURL.toString());
        const pages = document.numPages;
        log.debug(`${pages} detected.`)
        const pdfMetadata = new PDFMetadata(pdfURL.toString().toLowerCase(), pages, 0);
        log.debug(`Storing metadata`)
        await getManager().save(PDFMetadata, pdfMetadata);
        log.debug(`PDF metadata initialization complete`);
        return { pdfMetadata, document };
    } catch (err) {
        log.error(`Error initializing page metadata: ${err.message}`, err);
        if (err instanceof HttpError) throw err;
        throw createHttpError(500, err);
    }
}

export const mapPageKey = (pdfURL: URL, pdfName: string, page: number): string => {
    const hash = crypto.createHash('sha512');
    hash.update(Buffer.from(pdfURL.toString().toUpperCase()));
    const digest = hash.digest().toString('hex');
    return `${pdfName.toLowerCase()}-${digest}/${page}.jpeg`;
}
