import { Router, Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import * as pdfService from '../pdf-service';
import Readable from 'stream';
import pug from 'pug';
import { withLogger } from '@kidsloop-global/kidsloop-nodejs-logger';
import { Authorized, AuthType } from '../middleware/Access';
import { AllowedContentTypes } from '../middleware/ContentTypeFilter';

export const appRouter = Router();
const log = withLogger('app.router');

appRouter.post(`/validate`, 
    Authorized(AuthType.Authenticated), 
    AllowedContentTypes('application/pdf'),
    async (request: Request, response: Response, next: NextFunction) => {
        try {
            const registerTempFile = (filename: string) => response.locals.tempFiles = filename;
            log.debug(`Request to validate posted file of length ${request.headers['content-length']} from user: ${response.locals.token?.id} (${response.locals.token?.email})`)
            const valid = await pdfService.validatePostedPDF(request, registerTempFile);
            log.info(`Validation result: ${JSON.stringify(valid)}`)
            response.json(valid);
            next();
        } catch (err) {
            next(err);
        }
    }
);

appRouter.get(`/:pdfName/view.html`, Authorized(AuthType.Any),
    async (request: Request, response: Response, next: NextFunction) => {
    try {
        const { pdfName } = request.params;
        log.debug(`Handling request to render HTML document for ${pdfName}`)
        const pageCount = await pdfService.getPDFPages('assets', pdfName);
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
appRouter.get(`/:pdfName/prerender`, Authorized(AuthType.Any), 
    async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;
    log.info(`Request to prerender pages of ${pdfName}`);

    // Provide a callback function for the service to call to write the response
    const accepted = () => response.sendStatus(202);
    const reject = (err: Error) => next(err);

    // Error handling is delegated in the callback method, rather than try block
    // due to not wanting to wait for this method to resolve prior to responding to client
    pdfService.prerenderDocument('assets', pdfName, accepted, reject);
});

appRouter.get(`/:pdfName/validate`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName } = request.params;
    try {
        log.verbose(`Received request to validate PDF ${pdfName}`);
        const start = new Date().valueOf();
        const validationStatus = await pdfService.validateCMSPDF('assets', pdfName);
        const diff = new Date().valueOf() - start.valueOf();
        response.send({ ...validationStatus, processingTime: diff });
    } catch (err) {
        next(err);
    }
});

appRouter.get(`/:pdfName/page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    log.verbose(`Request for page ${page}`)
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
    
    response.contentType('image/jpeg')
    try {
        const stream: Readable = await pdfService.getPDFPage(pdfName, +page, 'assets');
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
appRouter.get(`/:pdfName/render-page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'development') {
        response.sendStatus(404);
    }

    const { pdfName, page } = request.params;
    log.debug(`Request for direct render of page ${page}`)
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

    response.contentType('image/jpeg')
    try {
        const stream: Readable = await pdfService.getDirectPageRender(+page, 'assets', pdfName);
        stream.pipe(response)
    } catch (err) {
        next(err);
        return;
    }
});
