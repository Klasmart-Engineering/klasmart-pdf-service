import { Canvas, JPEGStream } from 'canvas';
import * as pdf from 'pdfjs-dist/es5/build/pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import { withLogger } from './logger';

const log = withLogger('image-converter');

export const createDocumentFromStream = async (pdfUrl: string): Promise<PDFDocumentProxy> => {
    log.debug('creating document');
    return pdf.getDocument(pdfUrl).promise;
}

export const generatePageImage = async (document: PDFDocumentProxy, pageNumber: number): Promise<JPEGStream> => {
    log.debug(`creating page: ${pageNumber}/${document.numPages}`)
    const pageProxy = await document.getPage(pageNumber);

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
