import 'reflect-metadata';
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import express, { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { Readable } from 'stream';
import * as typeormConfig from './init-typeorm';
import * as pdfService from './pdf-service';
import { getPDFPage, getPDFPages } from './pdf-service';
import { withLogger } from './logger';
import * as s3Service from './s3-client';
import pug from 'pug';


const log = withLogger('app');

const app = express();
const port = process.env.PORT || 32891;

const routePrefix = process.env.ROUTE_PREFIX || '/pdf';

/* #region Initialization */
typeormConfig.initialize();
s3Service.initialize();
pdfService.initialize();

/* #endregion Initialization */

/* #region middleware */
app.get(`/.well-known/express/server-health`, (_, response: Response) => {
    response.sendStatus(200).end();
});

app.use((request: Request, _, next: NextFunction) => {
    log.silly(`Handling request with request path: ${request.path}`)
    next();
});

app.use((_, response: Response, next: NextFunction) => {
    response.set(`Access-Control-Allow-Origin`, `*`);
    next();
});

app.use(express.json());
app.use(express.static(__dirname + '/static'));
// app.use(express.static('static'));

/* Retrieves total number of pages */
app.get(`${routePrefix}/:pdfName/pages`, async (request: Request, response: Response, next: NextFunction) => {
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
    const pages = await getPDFPages(pdfURL);
    response
        .json({pages});
    next();
})

app.get(`${routePrefix}/:pdfName/view.html`, async (request: Request, response: Response, next: NextFunction) => {
    try {
        const { pdfName } = request.params;

        if (!pdfName) {
            response.sendStatus(400);
            return;
        }

        const pdfUrl = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
        const pageCount = await getPDFPages(pdfUrl);
        const pages = Array.from(new Array(pageCount-1)).map((x,i) => i);
        
        const output = pug.renderFile(__dirname + '/static/pdf.pug', { pages, pdfName });
        response
        .contentType('text/html')
        .send(output);
    } catch (err) {
        next(err);
        return;
    }
    next();
});

app.get(`${routePrefix}/:pdfName/page/:page`, async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    
    if (!pdfName || !page) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }
    
    const pdfURL = new URL(`/assets/${pdfName}`, process.env.CMS_BASE_URL);
    
    response.contentType('image/jpeg')

    const stream: Readable = await getPDFPage(pdfName, +page, pdfURL)
    
    stream.pipe(response)
});


app.get(`${routePrefix}/:pdfName/pages/:page`, async (request: Request, response: Response, next: NextFunction) => {
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

    const stream: Readable = await getPDFPage(pdfName, +page, pdfURL)
    
    stream.pipe(response)
});
/* #endregion middleware */

app.listen(port, () => {
    log.info(`Application listening with prefix ${routePrefix} on port ${port}`);
});

