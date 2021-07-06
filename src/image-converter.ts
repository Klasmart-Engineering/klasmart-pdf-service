import { Canvas, JPEGStream } from 'canvas';
import createHttpError from 'http-errors';
import * as pdf from 'pdfjs-dist/legacy/build/pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import { withLogger } from './logger';

const log = withLogger('image-converter');

export const createDocumentFromStream = async (pdfUrl: string): Promise<PDFDocumentProxy> => {
    log.debug('creating document');
    try {
        return pdf.getDocument(pdfUrl).promise;
    } catch (err) {
        log.error(`Error creating PDF document proxy: ${err.message}`);
        log.error(err);
        throw createHttpError(500, 'Error encountered creating PDF document');
    }
}

/**
 * Function validating PDF text content. Mapping text/font information is a common area where PDF issues
 * result in rendering issues. This method will consume a PDF document and attempt to validate the text
 * content and report failures that would not otherwise be known until time of rendering.
 * 
 * @param pdfUrl - Network location of the PDF to validate
 * @returns Promise<boolean> True indicating that no errors occurred while checking the PDF
 */
export const validatePDFTextContent = async (pdfUrl: string): Promise<boolean> => {
    log.debug(`Validating document: ${pdfUrl}`);
    try {
        const document = await pdf.getDocument({
            url: pdfUrl,
            stopAtErrors: true,
            // useSystemFonts: true
        }).promise;

        const pages = document.numPages;

        try {
            // Create an array of page nums, map them to page proxy promises, then map the proxies to a call to getTextContent
            // If all promises resolve correctly, the method should return true, otherwise rejections will cause a false return
            await Promise.all(
                Array.from(Array(pages)).map((x,i) => i+1)
                    .map(x => { console.log(`Validating page text content ${x}`); return x;})
                    .map(i => document.getPage(i))
                    .map(x => x.then(proxy => proxy.getTextContent()))
            );

            await Promise.all(
                Array.from(Array(pages)).map((x,i) => i+1)
                    .map(x => { console.log(`Validating page ${x} operator list`); return x;})
                    .map(i => document.getPage(i))
                    .map(x => x.then(proxy => proxy.getOperatorList()))
            );


        

            await Promise.all(
                Array.from(Array(pages)).map((x,i) => i+1)
                    .map(x => { console.log(`Validating page ${x} operator list`); return x;})
                    .map(i => document.getPage(i))
                    .map(async x => {
                         return x.then(proxy => {
                            const viewport = proxy.getViewport({scale: 3});
                            const canvas = new Canvas(viewport.width, viewport.height, "image");
                            return proxy.render({
                                canvasContext: canvas.getContext('2d'),
                                viewport
                            });
                        });
                    })
            );

            return true;
        } catch (err) {
            log.debug(`Error raised while validating PDF. PDF evaluated as invalid. Error message: ${err.message}`)
            return false;
        }
    } catch (err) {
        log.error(`Error creating PDF document proxy: ${err.message}`);
        log.error(err);
        throw createHttpError(500, 'Error encountered creating PDF document');
    }
}

export const generatePageImage = async (document: PDFDocumentProxy, pageNumber: number): Promise<JPEGStream> => {
    log.debug(`creating page: ${pageNumber}/${document.numPages}`)
    let pageProxy;
    try {
        pageProxy = await document.getPage(pageNumber);
    } catch (err) {
        log.error(`Error creating document: ${err.message}`)
        throw err;
    }
    log.debug('creating viewport/canvas')
    const viewport = pageProxy.getViewport({scale: 3});
    const canvas = new Canvas(viewport.width, viewport.height, "image");

    log.debug('rendering page to canvas');
    await pageProxy.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
    }).promise;

    log.debug('creating jpeg output stream');
    const imageOutputStream = canvas.createJPEGStream({
        quality: .99
    });
    
    return imageOutputStream;
}
