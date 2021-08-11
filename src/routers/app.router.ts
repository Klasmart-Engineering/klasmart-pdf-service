import { Router, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import * as pdfService from '../pdf-service';
import Readable from 'stream';
import pug from 'pug';
import { withLogger } from '../logger';
import { Authorized, AuthType } from '../middleware/Access';

export const appRouter = Router();
const log = withLogger('app.router');

appRouter.post(`/validate`, Authorized(AuthType.Authenticated), 
    async (request: Request, response: Response, next: NextFunction) => {
        const registerTempFile = (filename: string) => response.locals.tempFileNames = filename;
        const valid = pdfService.validatePostedPDF(request, registerTempFile);
        response.json(valid);
        next();
    }
);

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


/**
 * This endpoint is intended to allow automation hooks to
 * prerender a document without an initial user interaction.
 * This should result in faster initial views of documents as
 * users will not need to wait for initial renders.
 */
appRouter.get(`/:pdfName/prerender`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;
    log.info(`Request to prerender pages of ${pdfName}`);
    const pdfUrl = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);

    // Provide a callback function for the service to call to write the response
    const accepted = () => response.sendStatus(202);

    try {
        pdfService.prerenderDocument(pdfName, pdfUrl, accepted);
    } catch (err) {
        next(err);
        return;
    }
});

appRouter.get(`/:pdfName/validate`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;
    try {
        const start = new Date().valueOf();
        const validationStatus = await pdfService.validateCMSPDF(pdfName);
        const diff = new Date().valueOf() - start.valueOf();
        response.send({ ...validationStatus, processingTime: diff });
    } catch (err) {
        next(err);
    }
});

appRouter.get(`/:pdfName/page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    log.debug(`Request for page ${page}`)
    // ? Note: +num is being used rather than parseInt due to parseInt interpreting 0 lead ints as binary
    // ? while +num will drop the 0, a more inuitive behavior to service consumers

    if (isNaN(+page)) {
        next(createError(400, 'Page must be numeric'));
        return;
    }

    // Validate page is a natural number
    if (page.split('.').length > 1) {
        next(createError(400, 'Page may not contain a decimal portion'));
        return;
    }

    if (+page < 1) {
        next(createError(400, 'Page must be a positive value'));
        return;
    }
    
    const pdfURL = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
    
    response.contentType('image/jpeg')
    try {
        const stream: Readable = await pdfService.getPDFPage(pdfName, +page, pdfURL)
        stream.pipe(response)
    } catch (err) {
        next(err);
        return;
    }
});

/* 
    Utility endpoint which will bypass all FS/S3 workflows to directly render and display an image
    Note: This route is for dev/test purposes and is only made available when the NODE_ENV environment is set to dev
*/
if (process.env.NODE_ENV === 'development') {
    appRouter.get(`/:pdfName/render-page/:page`, async (request: Request, response: Response, next: NextFunction) => {
        const { pdfName, page } = request.params;
        log.debug(`Request for page ${page}`)
        // ? Note: +num is being used rather than parseInt due to parseInt interpreting 0 lead ints as binary
        // ? while +num will drop the 0, a more inuitive behavior to service consumers
    
        if (isNaN(+page)) {
            next(createError(400, 'Page must be numeric'));
            return;
        }
    
        // Validate page is a natural number
        if (page.split('.').length > 1) {
            next(createError(400, 'Page may not contain a decimal portion'));
            return;
        }
    
        if (+page < 1) {
            next(createError(400, 'Page must be a positive value'));
            return;
        }
    
        // doRender()

        const pdfURL = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
        
        response.contentType('image/jpeg')
        try {
            const stream: Readable = await pdfService.getDirectPageRender(+page, pdfURL)
            stream.pipe(response)
        } catch (err) {
            next(err);
            return;
        }
    });
}

/* Retrieves total number of pages */
// ! Deprecated
appRouter.get(`/:pdfName/pages`, async (request: Request, response: Response, next: NextFunction) => {
    log.warn(`Note: This handler is deprecated. This handler is being replaced by an updated endpoint which does not require a query parameter.  Update code to send requests to: pdf-service://pdf/{pdf-file.pdf}/view.html`);
    
    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
        return;
    }
    log.silly(request.query.pdfURL);
    const pdfURL = new URL(decodeURI(request.query.pdfURL as string))
    log.silly(pdfURL);
    log.silly(pdfURL.toString());
    try {
        const pages = await pdfService.getPDFPages(pdfURL);
        response
            .json({pages});
        next();
    } catch (err) {
        next(err);
    }
});

// ! Deprecated
appRouter.get(`/:pdfName/pages/:page`, async (request: Request, response: Response, next: NextFunction) => {
    log.warn(`Note: This handler is deprecated. This handler is being replaced by an updated endpoint which does not require a query parameter.  Update code to send requests to: pdf-service://pdf/{pdf-file.pdf}/view.html`);
    const { pdfName, page } = request.params;
    
    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
        return;
    }

    let pdfURL;
    try {
        pdfURL = new URL(decodeURI(request.query.pdfURL as string));
    } catch (err) {
        next(createError(400, 'URL is invalid'));
        return;
    }

    let stream: Readable;
    try {
        stream = await pdfService.getPDFPage(pdfName, +page, pdfURL)
    } catch (err) {
        next(err);
        return;
    }

    response.contentType('image/jpeg');
    stream.pipe(response);
});
