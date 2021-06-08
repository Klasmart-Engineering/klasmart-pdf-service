import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import { createDocumentFromStream, generatePageImage } from './image-converter';
import { putObject } from './s3-client';
import NodeCache from 'node-cache';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';

const pageResolutionCache = new NodeCache({ stdTTL: 100, checkperiod: 60});

export const getPDFPage = async (pageURL: string) => {
    const { pdfURL, page } = extractPageUrlProperties(pageURL);
    if (pageResolutionCache.has(pageURL)) {
        return pageResolutionCache.get<Promise<ReadableStream>>(pageURL);
    }
    
    if (! await pagePreRendered(pdfURL, page)) {
        await renderToPage(pageURL);
    }
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

const renderToPage = async (pageURL: string) => {
    const { pdfURL, page } = extractPageUrlProperties(pageURL);
    const pdfName = extractFilenameFromURL(pdfURL);
    const em = getManager();
    const pdfFilename = extractFilenameFromURL(pdfURL);
    let pdfMetadata: PDFMetadata | undefined = await em.findOne(pdfName, pdfURL);
    let document: PDFDocumentProxy;
    
    /* If this is our first time seeing the PDF, initialize the metadata.
        Otherwise, just get the document
    */
    if (!pdfMetadata) {
        ({ pdfMetadata, document } = await initializeMetadata(pdfURL, pdfName));
    } else {
        document = await createDocumentFromStream(pdfURL);
    }

    /* Configure page range to render */
    const [start, end] = [pdfMetadata.pagesGenerated, page];
    const range = createRangeInclusive(start, end);

    const promises = range
        .map(x => x) // TODO - Add cache step
        .map(async x => {
            const imageKey = mapPDFKeyToPageKey(pdfFilename, x);

            const jpegStreamPromise = generatePageImage(document, x);

            //? Cache promise so simultaneous requests won't attempt
            //? render the same page
            pageResolutionCache.set(pdfURL, jpegStreamPromise);

            const jpegStream = await jpegStreamPromise;
            return putObject(imageKey, jpegStream);
        });
    await Promise.all(promises);
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
const initializeMetadata = async (pdfURL: string, pdfName: string) => {
    const document = await createDocumentFromStream(pdfURL);
    const pages = document.numPages;
    const pdfMetadata = new PDFMetadata(undefined, pages, 0);
    await getManager().save(PDFMetadata, pdfMetadata);
    return { pdfMetadata, document };
}

const createRangeInclusive = (start: number, end: number) => {
    return Array.from(Array(end - start).keys()).map(x => x + start);
}

const extractFilenameFromURL = (url: string): string => {
    // TODO - Implement this once the format is better known
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
    let pdfKeyIndex: number;
    let pdfPageIndex: number;

    for(const [key, value] of URLParts.entries()) {
        if (value === 'assets') pdfKeyIndex = key + 1;
        if (value === 'page') pdfPageIndex = key + 1;
    }

    return {
        page: parseInt(URLParts[pdfPageIndex]),
        pdfURL: URLParts[pdfKeyIndex]
    }
}