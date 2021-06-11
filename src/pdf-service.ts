import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import { createDocumentFromStream, generatePageImage } from './image-converter';
import { putObject, readObject } from './s3-client';
import NodeCache from 'node-cache';
import createError from 'http-errors';
import { Readable } from 'stream';
import { PDFPageMetadata } from './models/PDFPageMetadata';

const pageResolutionCache = new NodeCache({ stdTTL: 100, checkperiod: 60});

export const getPDFPages = async (pdfURL: URL):Promise<number> => {
    const em = getManager();
    console.log('Checking for existing metadata');
    const existingMetadata = await em.findOne(PDFMetadata, pdfURL.pathname);
    
    if (existingMetadata) return existingMetadata.totalPages;

    console.log('No pre-existing metadata found. Initializing');
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
    console.debug('Checking if page metadata exists');
    const pageMetadata = await em.findOne(PDFPageMetadata, pageKey);

    // If the file is still loading, check if there is a promise in the cache, if so wait
    // for it to resolve, then resolve to true
    console.debug('Checking if page key is listed in the cache')
    if (pageResolutionCache.has(pageKey)) {
        console.debug('Page key found in cache, awaiting resolution if not already resolved');
        await pageResolutionCache.get(pageKey);
        console.debug('Resolved, page is prerendered');
        return true;
    }

    console.debug('Checking for page metadata');
    // If there is no page metadata, then we need to load it
    if (pageMetadata && pageMetadata.loaded) {
        console.debug('Page metadata lists page as loaded, return true');
        return true;
    }
    
    
    console.debug('No page metadata, page is not prerendered.')

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

        await putObject(pageKey, jpegStream);
        const pageMetadata = new PDFPageMetadata(pageKey, page, pdfMetadata, true);
        await em.save(pageMetadata);
    })();

    pageResolutionCache.set(pageKey, promise);

    return promise;
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
const initializeMetadata = async (pdfURL: URL) => {
    console.log(`Creating document for pdf located at ${pdfURL.toString()}`); 
    const document = await createDocumentFromStream(pdfURL.toString());
    const pages = document.numPages;
    console.log(`${pages} detected.`)
    const pdfMetadata = new PDFMetadata(pdfURL.pathname, pages, 0, []);
    console.log(`Storing metadata`)
    await getManager().save(PDFMetadata, pdfMetadata);
    console.log(`PDF metadata initialization complete`);
    return { pdfMetadata, document };
}

const mapPDFKeyToPageKey = (pdfKey: string, page: number) => {
    return `${pdfKey}/${page}.jpeg`
}
