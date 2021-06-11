import { Canvas, JPEGStream } from 'canvas';
import * as pdf from 'pdfjs-dist/es5/build/pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';

export const createDocumentFromStream = async (pdfUrl: string): Promise<PDFDocumentProxy> => {
    console.log('creating document');
    return pdf.getDocument(pdfUrl).promise;
}

export const generatePageImage = async (document: PDFDocumentProxy, pageNumber: number): Promise<JPEGStream> => {
    console.log(`creating page: ${pageNumber}/${document.numPages}`)
    const pageProxy = await document.getPage(pageNumber);

    console.log('creating viewport/canvas')
    const viewport = pageProxy.getViewport({scale: 3});
    const canvas = new Canvas(viewport.width, viewport.height, "image");

    console.log('rendering page to canvas');
    await pageProxy.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
    }).promise;

    console.log('creating jpeg output stream');
    const imageOutputStream = canvas.createJPEGStream({
        quality: .99
    });
    console.log('Resolving')
    return imageOutputStream;
}
