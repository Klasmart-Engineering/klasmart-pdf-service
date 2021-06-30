import { Router, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import * as pdfService from '../pdf-service';
import Readable from 'stream';
import pug from 'pug';
import { withLogger } from '../logger';

export const appRouter = Router();
const log = withLogger('app.router');

/* Retrieves total number of pages */
appRouter.get(`/:pdfName/pages`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;

    if (!pdfName) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }

    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
    }
    log.silly(request.query.pdfURL);
    const pdfURL = new URL(decodeURI(request.query.pdfURL as string))
    log.silly(pdfURL);
    log.silly(pdfURL.toString());
    const pages = await pdfService.getPDFPages(pdfURL);
    response
        .json({pages});
    next();
})

appRouter.get(`/:pdfName/view.html`, async (request: Request, response: Response, next: NextFunction) => {
    try {
        const { pdfName } = request.params;
        log.debug(`Handling request to render HTML document for ${pdfName}`)
        const pdfUrl = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
        log.debug(`Request URL: ${pdfUrl}`)
        const pageCount = await pdfService.getPDFPages(pdfUrl);
        log.debug(`Building document with ${pageCount} pages`)
        const pages = Array.from(new Array(pageCount-1)).map((x,i) => i);
        
        const output = pug.renderFile(__dirname + '/../static/pdf.pug', { pages, pdfName });
        response
            .contentType('text/html')
            .send(output);
    } catch (err) {
        log.error(err);
        next(err);
        return;
    }
    next();
});

appRouter.get(`/:pdfName/page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    
    if (!pdfName || !page) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }
    
    const pdfURL = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
    
    response.contentType('image/jpeg')

    const stream: Readable = await pdfService.getPDFPage(pdfName, +page, pdfURL)
    
    stream.pipe(response)
});


appRouter.get(`/:pdfName/pages/:page`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    
    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
    }
    const pdfURL = new URL(decodeURI(request.query.pdfURL as string));

    if (!pdfName || !page) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }
    
    response.contentType('image/jpeg')

    const stream: Readable = await pdfService.getPDFPage(pdfName, +page, pdfURL)
    
    stream.pipe(response)
});