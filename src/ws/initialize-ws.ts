import WebSocket from 'ws';
import { validatePDF } from './pdf-ws';
import { IncomingMessage } from 'http';
import { withLogger } from 'kidsloop-nodejs-logger';
import { Server } from 'http';

const log = withLogger('initialize-ws');

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
    });
    log.info('Websocket server created');
}
