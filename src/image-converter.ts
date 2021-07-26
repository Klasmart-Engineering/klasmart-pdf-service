import Canvas, { JPEGStream } from 'canvas';
import createHttpError from 'http-errors';
import * as pdf from 'pdfjs-dist/legacy/build/pdf.js';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { withLogger } from './logger';

const DEFAULT_SCALE = 3;
const DEFAULT_JPEG_IMAGE_QUALITY = 0.99;

const log = withLogger('image-converter');

// Some PDFs need external cmaps.
const CMAP_URL = __dirname + "/../node_modules/pdfjs-dist/cmaps/";
const CMAP_PACKED = true;

// Where the standard fonts are located.
const STANDARD_FONT_DATA_URL =
  __dirname + "/../node_modules/pdfjs-dist/standard_fonts/";

export const createDocumentFromStream = async (pdfUrl: string): Promise<PDFDocumentProxy> => {
    log.debug('creating document');
    try {
        // ? Note: await here allows for exceptions thrown by the promise to be caught in the try block
        
        return await pdf.getDocument({
            url: pdfUrl,
            cMapUrl: CMAP_URL,
            cMapPacked: CMAP_PACKED,
            standardFontDataUrl: STANDARD_FONT_DATA_URL,
        }).promise;
    } catch (err) {
        console.log(err);
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
  let document: PDFDocumentProxy;
  try {
      document =  await pdf.getDocument({
          url: pdfUrl,
          cMapUrl: CMAP_URL,
          cMapPacked: CMAP_PACKED,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
          stopAtErrors: true
      }).promise;
    } catch (err) {
      log.error(`Error creating PDF document proxy: ${err.message}`);
      log.error(err);
      throw createHttpError(500, 'Error encountered creating PDF document');
   }

    const pages = document.numPages;
    log.silly(`Document has ${pages} pages to validate`);

    try {

        for (let page = 1; page <= pages; page++) {
          const pageProxy: any = await document.getPage(page)
          const viewport = pageProxy.getViewport({ scale: parseFloat(process.env.IMAGE_SCALE as string) || DEFAULT_SCALE });
          const nodeCanvas = new NodeCanvas(viewport.width, viewport.height);
      
          const renderContext = {
              canvasContext: nodeCanvas.context,
              viewport,
              nodeCanvas,
          };
      
          log.debug(`Validating render of page ${page}/${pages} to canvas`);
          const renderTask = pageProxy.render(renderContext);
          await renderTask.promise
        }
        return true;
    } catch (err) {
        log.debug(`Error raised while validating PDF. PDF evaluated as invalid. Error message: ${err.message}`)
        return false;
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
    const viewport = pageProxy.getViewport({ scale: parseFloat(process.env.IMAGE_SCALE as string) || DEFAULT_SCALE });
    const nodeCanvas = new NodeCanvas(viewport.width, viewport.height);

    const renderContext = {
        canvasContext: nodeCanvas.context,
        viewport,
        nodeCanvas,
    };

    log.debug('rendering page to canvas');
    const renderTask = pageProxy.render(renderContext);
    await renderTask.promise
    
    // Convert the canvas to an image buffer.
    log.debug('creating jpeg output stream');
    const imageOutputStream = nodeCanvas.canvas?.createJPEGStream({
        quality: parseFloat(process.env.JPEG_QUALITY as string) || DEFAULT_JPEG_IMAGE_QUALITY,
    });
    
    if (!imageOutputStream) throw new Error('Cannot create ImageOutputStream with undefined NodeCanvas!');

    return imageOutputStream;
}

class NodeCanvas {

  canvas: Canvas.Canvas | null;
  context: Canvas.CanvasRenderingContext2D | null;

  constructor(width: number, height: number) {
    this.canvas = Canvas.createCanvas(width, height);
    this.context = this.canvas.getContext('2d');
  }

  reset (width: number, height: number) {
    if (!this.canvas) throw new Error('Canvas undefined');
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy() {
    if (this.canvas) {
      // Zeroing the width and height cause Firefox to release graphics
      // resources immediately, which can greatly reduce memory consumption.
      this.canvas.width = 0;
      this.canvas.height = 0;
      this.canvas = null;
    }

    if (this.context) {
      this.context = null;
    }
  }
}
