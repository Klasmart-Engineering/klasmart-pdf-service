import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import { createDocumentFromStream, generatePageImage } from './image-converter';
import { putObject, readObject } from './s3-client';
import NodeCache from 'node-cache';
import createError from 'http-errors';
import { Readable } from 'stream';
import { PDFPageMetadata } from './models/PDFPageMetadata';
import { withLogger } from './logger';
import fs from 'fs';
import { JPEGStream } from 'canvas';

const log = withLogger('pdf-service');

const pageResolutionCache = new NodeCache({ stdTTL: 100, checkperiod: 60});

export const getPDFPages = async (pdfURL: URL):Promise<number> => {
    let existingMetadata;
    try {
        const em = getManager();
        log.debug('Checking for existing metadata');
        existingMetadata = await em.findOne(PDFMetadata, pdfURL.pathname);
    } catch (err) {
        log.error(`Error while attempting to retrieve metadata from the database: ${err.message}`);
        throw err;
    }
        
        if (existingMetadata) return existingMetadata.totalPages;

        log.debug('No pre-existing metadata found. Initializing');
        const { pdfMetadata } = await initializeMetadata(pdfURL);

        return pdfMetadata.totalPages;
}

export const getPDFPage = async (pdfName: string, page: number, pdfURL: URL): Promise<Readable> => {
    const pageKey = mapPDFKeyToPageKey(pdfName, page);
    
    if (! await isPagePreRendered(pageKey)) {
        await renderSinglePage(pageKey, pdfURL, page);
    }

    return readObject(pageKey);
}

const isPagePreRendered = async (pageKey: string) => {
    const em = getManager();
    log.debug('Checking if page metadata exists');
    const pageMetadata = await em.findOne(PDFPageMetadata, pageKey);

    // If the file is still loading, check if there is a promise in the cache, if so wait
    // for it to resolve, then resolve to true
    log.debug('Checking if page key is listed in the cache')
    if (pageResolutionCache.has(pageKey)) {
        log.debug('Page key found in cache, awaiting resolution if not already resolved');
        await pageResolutionCache.get(pageKey);
        log.debug('Resolved, page is prerendered');
        return true;
    }

    log.debug('Checking for page metadata');
    // If there is no page metadata, then we need to load it
    if (pageMetadata && pageMetadata.loaded) {
        log.debug('Page metadata lists page as loaded, return true');
        return true;
    }
    
    
    log.debug('No page metadata, page is not prerendered.')

    // If there is no promise in the cache, then return false, the page will need to be processed
    return false;
}

const renderSinglePage = async (pageKey: string, pdfURL: URL, page: number) => {
    // Async code invoked via IIFE to allow immediate access to the promise to cache
    const promise = (async () => {
        const em = getManager();
        const pdfMetadata = await em.findOne(PDFMetadata, pdfURL.pathname);
        if (!pdfMetadata) throw createError(400, 'Bad PDF name');
        
        if (pdfMetadata.totalPages < page) {
            throw createError(404, `Document does not contain page: ${page}`)
        }
        
        const document = await createDocumentFromStream(pdfURL.toString());
        const jpegStream = await generatePageImage(document, page);

        // S3 requires a content-length field, to get this we will first write to
        // a temp file
        const filename = `./${pageKey.replace('/', '-')}`;
        const contentLength = await writeStreamToTempFile(filename, jpegStream)
        const readStream = fs.createReadStream(filename);

        await putObject(pageKey, readStream, contentLength);
        const pageMetadata = new PDFPageMetadata(pageKey, page, pdfMetadata, true);
        await em.save(pageMetadata);
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
    const document = await createDocumentFromStream(pdfURL.toString());
    const pages = document.numPages;
    log.debug(`${pages} detected.`)
    const pdfMetadata = new PDFMetadata(pdfURL.pathname, pages, 0, []);
    log.debug(`Storing metadata`)
    await getManager().save(PDFMetadata, pdfMetadata);
    log.debug(`PDF metadata initialization complete`);
    return { pdfMetadata, document };
}

const mapPDFKeyToPageKey = (pdfKey: string, page: number) => {
    return `${pdfKey}/${page}.jpeg`
}
