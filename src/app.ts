import 'reflect-metadata';
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import express, { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import { Readable } from 'stream';
import initTypeorm from './init-typeorm';
import { getPDFPage, getPDFPages } from './pdf-service';
import { withLogger } from './logger';

const log = withLogger('app');

const app = express();
const port = 32891 || process.env.PORT;

/* #region Initialization */
initTypeorm();

/* #endregion Initialization */

/* #region middleware */

app.use((_, response: Response, next: NextFunction) => {
    response.set(`Access-Control-Allow-Origin`, `*`);
    next();
});

app.use(express.json());

/* Retrieves total number of pages */
app.get('/assets/:pdfName/pages', async (request: Request, response: Response, next: NextFunction) => {
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
        .contentType('image/jpeg')
        .json({pages});
    next();
})

app.get('/assets/:pdfName/pages/:page', async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    
    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
    }
    const pdfURL = new URL(decodeURI(request.query.pdfURL as string));

    if (!pdfName || !page) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }

    const stream: Readable= await getPDFPage(pdfName, +page, pdfURL)
    stream.pipe(response)

})
/* #endregion middleware */

app.listen(port, () => {
    log.info(`Application listening on port ${port}`);
});

