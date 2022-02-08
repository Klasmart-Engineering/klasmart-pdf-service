import WebSocket from 'ws';
import { validatePDF, validatePDFByContentId } from './pdf-ws';
import { IncomingMessage } from 'http';
import { withLogger } from '@kidsloop-global/kidsloop-nodejs-logger';
import { Server } from 'http';

const log = withLogger('initialize-ws');

const validateByContentIdRegex = new RegExp(/^\/pdf\/v2\/(?:([^/]+?))\/(?:([^/]+?))\/validate\/?$/i);

export function hookWebsocketHandler(server: Server): void {
    log.info('Registering websocket handlers on server');
    const websocketServer = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
        log.silly(`Upgrading websocket connection`)
        websocketServer.handleUpgrade(request, socket, head, (websocket) => {
            websocketServer.emit('connection', websocket, request);
        });
    });
    
    websocketServer.on('connection', async (connection: WebSocket, connectionRequest: IncomingMessage) => {
        if (!connectionRequest?.url) {
            log.debug(`No url found on upgraded connection`);
            connection.close();
            return;
        }
        
        const [path, _params] = connectionRequest.url.split('?');
        log.silly(`Routing websocket connect request for path: ${path}`);
        switch(path) {
            case '/pdf/v2/validate': return await validatePDF(connection);
        }

        if (validateByContentIdRegex.test(path)) {
            const [_host, _pdf, _v2, cmsPath, contentId] = path.split('/');
            // const contentId = path.split('/')[3];
            validatePDFByContentId(connection, cmsPath, contentId);
            return;
        }
        
    });
    log.info('Websocket server created');
}
