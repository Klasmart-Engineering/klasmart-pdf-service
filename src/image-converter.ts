import { Canvas, JPEGStream } from 'canvas';
import * as pdf from 'pdfjs-dist/es5/build/pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import fs from 'fs';

export const createDocumentFromStream = async (pdfUrl: string) => {
    console.log('creating document');
    return pdf.getDocument(pdfUrl).promise;
}

export const generatePageImage = async (document: PDFDocumentProxy, pageNumber: number) => {
    return new Promise<JPEGStream>( async (resolve, reject) => {
        console.log('creating page')
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
    
        return imageOutputStream;

        // console.log('creating file output stream');
        // const outputStream = fs.createWriteStream(`./pdf/${pageNumber}-99.jpeg`);


        // console.log('registering stream listeners');
        // outputStream.on('done', () => resolve(undefined));
        // outputStream.on('error', (error) => {
        //     console.log(error);
        //     reject(error);
        // })
    
        // console.log('piping streams');
        // imageOutputStream.pipe(outputStream);
        // console.log('Stream complete');
    })
}
