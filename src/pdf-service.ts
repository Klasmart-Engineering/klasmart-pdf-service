import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import { createDocumentFromStream, generatePageImage } from './image-converter';
import { putObject, readObject } from './s3-client';
import NodeCache from 'node-cache';
import createError from 'http-errors';
import { Readable } from 'stream';
import { PDFPageMetadata } from './models/PDFPageMetadata';

const pageResolutionCache = new NodeCache({ stdTTL: 100, checkperiod: 60});

export const getPDFPages = async (pdfName: string, pdfURL: URL):Promise<number> => {
    const em = getManager();
    console.log('Checking for existing metadata');
    const existingMetadata = await em.findOne(PDFMetadata, pdfURL.pathname);
    
    if (existingMetadata) return existingMetadata.totalPages;

    console.log('No pre-existing metadata found. Initializing');
    const { pdfMetadata } = await initializeMetadata(pdfURL, pdfName);

    return pdfMetadata.totalPages;
}

export const getPDFPage = async (pdfName: string, page: number, pdfURL: URL): Promise<Readable> => {
    const pageKey = mapPDFKeyToPageKey(pdfName, page);
    // if (pageResolutionCache.has(pageKey) && pageResolutionCache.get(pageKey)) {
    //     return pageResolutionCache.get<Promise<Readable>>(pageKey);
    // }
    
    if (! await isPagePreRendered(pageKey)) {
        await renderSinglePage(pageKey, pdfURL, pdfName, page);
    }

    return readObject(pageKey);
}

const isPagePreRendered = async (pageKey: string) => {
    const em = getManager();
    const pageMetadata = await em.findOne(PDFPageMetadata, pageKey);



    // If there is no page metadata, then we need to load it
    if (!pageMetadata) return false;

    // If the file is still loading, check if there is a promise in the cache, if so wait
    // for it to resolve, then resolve to true
    if (pageResolutionCache.has(pageKey)) {
        await pageResolutionCache.get(pageKey);
        return true;
    }

    // If there is no promise in the cache, then return false, the page will need to be processed
    return false;
}

const renderSinglePage = async (pageKey: string, pdfURL: URL, pdfName: string, page: number) => {
    const promise = new Promise(async (resolve, reject) => {
        const em = getManager();
        const pdfMetadata = await em.findOne(PDFMetadata, pdfURL.pathname);
        if (!pdfMetadata) throw createError(400, 'Bad PDF name');
        
        if (pdfMetadata.totalPages < page) {
            throw createError(404, `Document does not contain page: ${page}`)
        }
        
        const document = await createDocumentFromStream(pdfURL.toString());
        const jpegStream = await generatePageImage(document, page);
        

        await putObject(pageKey, jpegStream);
        const pageMetadata = new PDFPageMetadata(pageKey, page, pdfMetadata, true)
        resolve(undefined);        
    });

    pageResolutionCache.set(pageKey, promise);

    return promise;
}

const renderToPage = async (pageKey: string, pdfURL: URL, pdfName: string, page: number) => {
    const em = getManager();
    const pdfFilename = pdfURL.pathname;
    const pdfMetadata: PDFMetadata | undefined = await em.findOne(PDFMetadata, pdfURL.pathname);
    
    /* We should find a PDF - it should exist in the DB before a
        page is requrested for it, so if we don't find one this is
        an error case
    */
    if (!pdfMetadata) throw createError(400, 'Bad PDF name');

    const document = await createDocumentFromStream(pdfURL.toString());

    /* Configure page range to render */
    const [start, end] = [pdfMetadata.pagesGenerated, page];
    const range = createRangeInclusive(start, end);
    console.log(`Pages to generate: ${range}`)

    const promises = range
        .map(async x => {
            const jpegStreamPromise = generatePageImage(document, x);
    
            // console.log('Assigning promise to cache');
            // //? Cache promise so simultaneous requests won't attempt
            // //? render the same page
            // pageResolutionCache.set(pdfURL.toString(), jpegStreamPromise);

            console.log('Awaiting creation of jpeg stream');
            const jpegStream = await jpegStreamPromise;

            console.log(`Storing data`)
            return putObject(mapPDFKeyToPageKey(pdfName, x), jpegStream);
        });
    

    pdfMetadata.pagesGenerated = page;
    await Promise.all(promises);
    await getManager().save(pdfMetadata);
    // Return the last promise, which will be the actual
    //  requested page
    return promises[promises.length - 1]
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
const initializeMetadata = async (pdfURL: URL, pdfName: string) => {
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

const createRangeInclusive = (start: number, end: number) => {
    return Array.from(Array(end - start).keys()).map(x => x + start + 1);
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