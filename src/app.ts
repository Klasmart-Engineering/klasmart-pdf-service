import 'reflect-metadata';
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import express, { NextFunction, Response } from 'express';
import * as typeormConfig from './init-typeorm';
import * as pdfService from './pdf-service';
import { withLogger } from './logger';
import * as s3Service from './s3-client';
import { errorHandler } from './util/error-handler';
import { appRouter } from './routers/app.router';

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
// ! Note: This endpoint is used for ECS healthchecks. If it is removed, AWS will kill the app after a few minutes!
app.get(`/.well-known/express/server-health`, (_, response: Response) => {
    response.sendStatus(200).end();
});

app.use((_, response: Response, next: NextFunction) => {
    response.set(`Access-Control-Allow-Origin`, `*`);
    next();
});

app.use(express.json());

log.info(`Registering static file access to '/static'`);
app.use(express.static(__dirname + '/static'));

log.info(`Registering appRouter with prefix: ${routePrefix}`)
app.use(routePrefix, appRouter);

log.info(`Registering error handler middleware`);
app.use(errorHandler);

// ? Exposes PDF documents for testing
if (process.env.EXPOSE_TESTING_PDFS == 'EXPOSE') {
    log.warn(`Exposing testing pdfs`)
    app.use(express.static(__dirname + '/testing-pdfs'));
}  

/* #endregion middleware */

const server = app.listen(port, () => {
    log.info(`Application listening with prefix ${routePrefix} on port ${port}`);
});

server.on('connection', (conn) => {
    conn.setKeepAlive(true);
    conn.setTimeout(1000 * 60 * 10);
});
