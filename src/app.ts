import 'newrelic';
import 'reflect-metadata';
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import express, { Response } from 'express';
import * as typeormConfig from './init-typeorm';
import * as pdfService from './pdf-service';
import * as s3Service from './s3-client';
import { errorHandler } from './util/error-handler';
import { appRouter } from './routers/app.router';
import { appRouter as appV2Router } from './routers/app.router.v2';
import cookieParser from 'cookie-parser';
import { kidsloopAuthMiddleware } from '@kl-engineering/kidsloop-token-validation';
import { cleanupTempFile } from './middleware/temp-file-cleanup';
import { contentLengthFilter } from './middleware/content-length-filter';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { version } from '../package.json';
import { correlationMiddleware, withLogger } from '@kl-engineering/kidsloop-nodejs-logger';
import { corsMiddleware } from './middleware/cors-middleware';
import { Server } from 'http';
import { hookWebsocketHandler } from './ws/initialize-ws';

const log = withLogger('app');

log.info(`Starting in node environment: ${process.env.NODE_ENV}`)
log.info(`Running pdf-service v${version} on Node ${process.version}`)

const app = express();
app.disable('x-powered-by');

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
app.use(correlationMiddleware());

app.use((request, _response, next) => {
    log.verbose(`Receiving ${request.method} request for ${request.path}.`);
    next();
});

app.use(cookieParser());
app.use(kidsloopAuthMiddleware({
    logger: withLogger('kidsloopAuthMiddleware')
}));
app.use(contentLengthFilter({ maxLength: 524_288_000 }))

app.use(corsMiddleware());

app.use(express.json());

log.info(`Registering static file access to '/static'`);

app.use(express.static(__dirname + '/static'));

if (process.env.NODE_ENV?.toUpperCase().startsWith('DEV')) {
    log.warn(`Registering development only static file access to /dev-static`);
    app.use(express.static(__dirname + '/dev-static'));
}

log.info(`Registering appRouter with prefix: ${routePrefix}`)
app.use(routePrefix, appRouter);
app.use(`${routePrefix}/v2`, appV2Router);

log.info(`Registering error handler middleware`);
app.use(errorHandler);

// ? Exposes PDF documents for testing
if (process.env.EXPOSE_TESTING_PDFS == 'EXPOSE') {
    log.warn(`Exposing testing pdfs`)
    app.use(express.static(__dirname + '/testing-pdfs'));
}

const swaggerDocument = YAML.load('./api.yaml');
app.use('/pdf/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {customSiteTitle: 'Kidsloop PDF Service API Docs'}))

app.use(cleanupTempFile());

/* #endregion middleware */

const server: Server = app.listen(port, () => {
    log.info(`Application listening with prefix ${routePrefix} on port ${port}`);
});

// Hook WS Handling Logic
hookWebsocketHandler(server);

server.on('connection', (conn) => {
    conn.setKeepAlive(true);
    conn.setTimeout(1000 * 60 * 10);
});
