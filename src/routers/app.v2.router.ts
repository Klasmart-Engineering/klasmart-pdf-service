import { Router, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import * as pdfService from '../pdf-service';
import Readable from 'stream';
import pug from 'pug';
import { withLogger } from 'kidsloop-nodejs-logger';
import { Authorized, AuthType } from '../middleware/Access';
import { AllowedContentTypes } from '../middleware/ContentTypeFilter';

export const appRouterV2 = Router();
const log = withLogger('app.v2.router');

appRouterV2.post(`/validate`, 
    Authorized(AuthType.Authenticated), 
    AllowedContentTypes('application/pdf'),
    async (request: Request, response: Response, next: NextFunction) => {
        try {
            log.debug(`Request to validate posted file of length ${request.headers['content-length']} from user: ${response.locals?.token?.id} (${response.locals?.token?.email})`)
            const initialStatus = await pdfService.validatePostedPDFAsync(request);
            response.status(200).json(initialStatus);
            next();
        } catch (err) {
            next(err);
        }
    }
);

appRouterV2.get(`/validate/:key`,
    Authorized(AuthType.Authenticated),
    async (request: Request, response: Response, next: NextFunction) => {
        try {
            const key = request.params.key;
            log.debug(`Request to check validation status of document with key: ${key}`)
            const result = await pdfService.getAsyncValidationStatus(key);
            if (!result) {
                log.silly(`No validation data for document with key: ${key}`);
                response.sendStatus(404);
                return;
            }
            response.json(result);
        } catch (err) {
            next(err);
        }
    })

appRouterV2.get(`/:pdfName/view.html`, Authorized(AuthType.Any),
    async (request: Request, response: Response, next: NextFunction) => {
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
appRouterV2.get(`/:pdfName/prerender`, Authorized(AuthType.Any), 
    async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;
    log.info(`Request to prerender pages of ${pdfName}`);
    const pdfUrl = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);

    // Provide a callback function for the service to call to write the response
    const accepted = () => response.sendStatus(202);
    const reject = (err: Error) => next(err);

    // Error handling is delegated in the callback method, rather than try block
    // due to not wanting to wait for this method to resolve prior to responding to client
    pdfService.prerenderDocument(pdfName, pdfUrl, accepted, reject);
});

appRouterV2.get(`/:pdfName/validate`, async (request: Request, response: Response, next: NextFunction) => {
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

appRouterV2.get(`/:pdfName/page/:page`, async (request: Request, response: Response, next: NextFunction) => {
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
appRouterV2.get(`/:pdfName/render-page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'development') {
        response.sendStatus(404);
    }

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
        const stream: Readable = await pdfService.getDirectPageRender(+page, pdfURL)
        stream.pipe(response)
    } catch (err) {
        next(err);
        return;
    }
});
