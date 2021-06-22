import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import * as imageConverter from './image-converter';
import * as s3Service from './s3-client';
import NodeCache from 'node-cache';
import createError from 'http-errors';
import { Readable } from 'stream';
import { withLogger } from './logger';
import fs from 'fs';
import { JPEGStream } from 'canvas';
import crypto from 'crypto';
import createHttpError from 'http-errors';

const log = withLogger('pdf-service');

let pageResolutionCache: NodeCache;

/**
 * Provides configuration for the PDF service
 * @param cache - Provided NodeCache. Will use a default configuration if not provided
 */
export const initialize = (cache?: NodeCache): void => {
    pageResolutionCache = cache ?? new NodeCache({stdTTL: 100, checkperiod: 60});
}

export const getPDFPages = async (pdfURL: URL):Promise<number> => {
    let existingMetadata;
    try {
        const em = getManager();
        log.debug('Checking for existing metadata');
        existingMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
    } catch (err) {
        log.error(`Error while attempting to retrieve metadata from the database: ${err.message}`);
        throw createHttpError(500, err);
    }
        
    if (existingMetadata) return existingMetadata.totalPages;

    log.debug('No pre-existing metadata found. Initializing');
    const { pdfMetadata } = await initializeMetadata(pdfURL);

    return pdfMetadata.totalPages;
}

/* Produces the page key for the pdf, then attempts to load it from s3.
    If the object is not in S3, then the application will check the page cache. If the pageKey is found in the cache, 
    then it will await page creation and then read the page image.
    If the pageKey is not in the cache it will add it to the cache and then load the PDF, generate an image for the page and save it to S3,
        then return a stream for this image
*/
export const getPDFPage = async (pdfName: string, page: number, pdfURL: URL): Promise<Readable> => {
    const pageKey = mapPageKey(pdfURL, pdfName, page);
    
    const pageStream: Readable | undefined = await s3Service.readObject(pageKey);

    if (pageStream) return pageStream;
    
    if (pageResolutionCache.has(pageKey)) {
        log.debug('Page key found in cache, awaiting resolution if not already resolved');
        await pageResolutionCache.get(pageKey);
        log.debug('Resolved, page is prerendered');
        const stream = await s3Service.readObject(pageKey);
        if (stream) return stream;
    }


    await renderSinglePage(pageKey, pdfURL, page);
    const stream = await s3Service.readObject(pageKey);
    if (!stream) throw createHttpError(500);
    return stream;
}


const renderSinglePage = async (pageKey: string, pdfURL: URL, page: number) => {
    // Async code invoked via IIFE to allow immediate access to the promise to cache
    const promise = (async () => {
        const em = getManager();
        const pdfMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
        if (!pdfMetadata) throw createError(400, 'Bad PDF name');
        
        if (pdfMetadata.totalPages < page) {
            throw createError(404, `Document does not contain page: ${page}`)
        }
        
        const document = await imageConverter.createDocumentFromStream(pdfURL.toString());

        const jpegStream = await imageConverter.generatePageImage(document, page);

        // S3 requires a content-length field, to get this we will first write to
        // a temp file
        const filename = `./${pageKey.replace('/', '-')}`;
        let contentLength: number;
        try {
            contentLength = await writeStreamToTempFile(filename, jpegStream)
        } catch (err) {
            log.error(`Error writing image to temporary file: ${err.message}`, err);
            throw createHttpError(500, [new Error('Error writing image to temporary file')]);
        }
        const readStream = fs.createReadStream(filename);

        await s3Service.putObject(pageKey, readStream, contentLength);
        await fs.promises.rm(filename);
    })();

    pageResolutionCache.set(pageKey, promise);

    return promise;
}

const writeStreamToTempFile = (filename: string, stream: JPEGStream): Promise<number> => {
    
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filename);
        
        stream.on('end', () => {
            log.info(`stream end`);
            const contentLength = fileStream.bytesWritten;
            log.info(`contentLength: ${contentLength}`)
            resolve(contentLength);
        })

        fileStream.on('error', (err) => {
            log.error(`Error streaming to temporary file: ${err.message}`)
            reject(err);
        });

        stream.on('error', (err) => {
            log.error(`Error in JPEG stream: ${err.message}`)
        })
        log.info('Piping file');
        stream.pipe(fileStream);
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
        throw createHttpError(500, err);
    }
}

export const mapPageKey = (pdfURL: URL, pdfName: string, page: number): string => {
    const hash = crypto.createHash('sha512');
    hash.update(Buffer.from(pdfURL.toString().toUpperCase()));
    const digest = hash.digest().toString('hex');
    return `${pdfName.toLowerCase()}-${digest}/${page}.jpeg`;
}
