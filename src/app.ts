import express, { NextFunction, Request, Response } from 'express';
import createError from 'http-errors';
import initTypeorm from './init-typeorm';
import { getPDFPage, getPDFPages } from './pdf-service';

const app = express();
const port = 8080 || process.env.PORT;

/* #region Initialization */
initTypeorm();

/* #endregion Initialization */

/* #region middleware */

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
    const pdfURL = decodeURI(request.query.pdfURL as string)

    return getPDFPages(pdfName, pdfURL);
})

app.get('/assets/:pdfName/pages/:page', async (request: Request, response: Response, next: NextFunction) => {
    const { pdfName, page } = request.params;
    
    if (!request.query.pdfURL){
        next(createError(400, `Missing query parameters: [pdfURL]`))
    }
    const pdfURL = decodeURI(request.query.pdfURL as string)

    if (!pdfName || !page) {
        next(createError(400, 'Invalid Request URL'));
        return;
    }

    getPDFPage(pdfName, +page, pdfURL)

})
/* #endregion middleware */

app.listen(port, () => {
    console.log(`Application listening on port ${port}`);
});

