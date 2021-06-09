import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import { createDocumentFromStream, generatePageImage } from './image-converter';
import { putObject, readObject } from './s3-client';
import NodeCache from 'node-cache';
import createError from 'http-errors';

const pageResolutionCache = new NodeCache({ stdTTL: 100, checkperiod: 60});

export const getPDFPages = async (pdfName: string, pdfURL: string) => {
    const em = getManager();
    const existingMetadata = await em.findOne(PDFMetadata, pdfName);
    
    if (existingMetadata) return existingMetadata.totalPages;

    const { pdfMetadata } = await initializeMetadata(pdfURL, pdfName);
    return pdfMetadata.totalPages;
}

export const getPDFPage = async (pdfName: string, page: number, pdfURL: string) => {
    const pageKey = mapPDFKeyToPageKey(pdfName, page);
    if (pageResolutionCache.has(pageKey)) {
        return pageResolutionCache.get<Promise<ReadableStream>>(pageKey);
    }
    
    if (! await pagePreRendered(pdfURL, page)) {
        await renderToPage(pageKey, pdfURL, page);
    }

    const pdfKey = extractPDFFilenameFromPDFURL(pdfURL)
    readObject(mapPDFKeyToPageKey(pdfKey, page));
}

const pagePreRendered = async (pdfURL: string, page: number) => {
    const em = getManager();
    const pdfMetadata = await em.findOne(PDFMetadata, pdfURL);

    if (!pdfMetadata) return false;

    if (pdfMetadata.pagesGenerated >= page) {
        return true;
    }

    if (pdfMetadata.totalPages < page) {
        throw new Error('Invalid page requested');
    }

    return false;
}

const renderToPage = async (pageKey: string, pdfURL: string, page: number) => {
    const em = getManager();
    const pdfFilename = extractPDFFilenameFromPDFURL(pdfURL);
    const pdfMetadata: PDFMetadata | undefined = await em.findOne(pdfFilename, pdfURL);
    
    /* We should find a PDF - it should exist in the DB before a
        page is requrested for it, so if we don't find one this is
        an error case
    */
    if (!pdfMetadata) throw createError(400, 'Bad PDF name');

    const document = await createDocumentFromStream(pdfURL);

    /* Configure page range to render */
    const [start, end] = [pdfMetadata.pagesGenerated, page];
    const range = createRangeInclusive(start, end);

    const promises = range
        .map(x => x)
        .map(async x => {
            const imageKey = mapPDFKeyToPageKey(pdfFilename, x);

            const jpegStreamPromise = generatePageImage(document, x);

            //? Cache promise so simultaneous requests won't attempt
            //? render the same page
            pageResolutionCache.set(pdfURL, jpegStreamPromise);


            const jpegStream = await jpegStreamPromise;
            putObject(imageKey, jpegStream);
            return jpegStream;
        });
    
    // Return the last promise, which will be the actual
    //  requested page
    return promises[promises.length - 1]
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
const initializeMetadata = async (pdfURL: string, pdfName: string) => {
    const document = await createDocumentFromStream(pdfURL);
    const pages = document.numPages;
    const pdfMetadata = new PDFMetadata(pdfName, pages, 0);
    await getManager().save(PDFMetadata, pdfMetadata);
    return { pdfMetadata, document };
}

const createRangeInclusive = (start: number, end: number) => {
    return Array.from(Array(end - start).keys()).map(x => x + start);
}

const extractPDFFilenameFromPDFURL = (url: string): string => {
    return url;
}

/**\
 * 
 */
const mapPDFKeyToPageKey = (pdfKey: string, page: number) => {
    return `${pdfKey}/${page}.jpeg`
}

/**
 * Uses the CF URL structure to extract the target PDF and the page
 * number that should be rendered
 * @param pageUrl 
 * @returns 
 */
const extractPageUrlProperties = (pageUrl: string) => {
    const URLParts = pageUrl.split('/');
    let pdfKeyIndex: number = 0;
    let pdfPageIndex: number = 0;

    for (const [key, value] of URLParts.entries()) {
        if (value === 'assets') pdfKeyIndex = key + 1;
        if (value === 'page') pdfPageIndex = key + 1;
    }

    if (pdfKeyIndex === 0) {
        throw new Error(`pageURL did not contain 'assets' part`);
    } 

    if (pdfPageIndex === 0) {
        throw new Error(`pageURL did not contain 'page' part`);
    } 

    return {
        page: parseInt(URLParts[pdfPageIndex]),
        pdfURL: URLParts[pdfKeyIndex]
    }
}