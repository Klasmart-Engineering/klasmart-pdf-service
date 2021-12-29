import express from 'express';
import { withLogger } from 'kidsloop-nodejs-logger';
import { hookWebsocketHandler } from '../../src/ws/initialize-ws';
import { Server } from 'http';
import { WebSocket } from 'ws';
import fs from 'fs';
import { ValidationStatus } from '../../src/interfaces/validation-status';
import { assert } from 'chai';

const log = withLogger('pdf-ws.test');

// Initialize server with ws configuration

const pdfData = `%PDF-1.0
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj
xref
0 4
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
149
%EOF`;



describe('pdf-ws', () => {

    let wsServerAddress: string;
    let server: Server;

    before(() => {
        const port = 8888;
        const app = express();
        app.use((req, _res, next) => {
            console.log(`request received for path: ${req.path}`);
            next();
        })
        server = app.listen(port, () => {
            log.debug('Test server for ws integration tests listening on port 8888');
        });
        wsServerAddress = `ws://localhost:${port}` 

        hookWebsocketHandler(server);

        server.on('connection', (conn) => {
            conn.setKeepAlive(true);
            conn.setTimeout(1000 * 60 * 10);
        });
    });

    describe('validatePDF', () => {

        
        it('should send validation status updates', (done) => {
            const routeEndpoint = `ws://localhost:8888/pdf/v2/validate`;
            const socket = new WebSocket(routeEndpoint);

            socket.on('connect_error', (err) => {
                log.error(err.stack);
                throw err;
            })
            
            socket.on('open', () => {
                const buff = Buffer.from(pdfData);
                socket.send(buff);
            })
            socket.on('message', (buffer) => {
                const payload = JSON.parse(buffer.toString());
                if (payload.validationComplete) {
                    done();
                }
            });
        });

        it('should send validation status updates in sequential page order', (done) => {
            
            const routeEndpoint = `ws://localhost:8888/pdf/v2/validate`;
            const socket = new WebSocket(routeEndpoint);
            socket.on('connect_error', (err) => {
                log.error(err.stack);
                throw err;
            })
            let previousPage: number;
            socket.on('open', () => {
                const data = fs.readFileSync('./__tests__/integration/resources/long.pdf');
                const buff = Buffer.from(data);
                socket.send(buff);
            })
            socket.on('message', (buffer) => {
                const payload: ValidationStatus = JSON.parse(buffer.toString());
                
                if (payload.validationComplete) {
                    done();
                    return;
                }

                if (!previousPage) {
                    previousPage = payload.pagesValidated;
                } else {
                    if (++previousPage !== payload.pagesValidated) {
                        assert.fail(`Status for page ${payload.pagesValidated} should follow ${payload.pagesValidated - 1}, but followed ${previousPage - 1}`);
                    }
                }
            });
        }).timeout(75_000);

        it('should terminate with an update with validationComplete value of true', (done) => {
            const routeEndpoint = `ws://localhost:8888/pdf/v2/validate`;
            const socket = new WebSocket(routeEndpoint);
            let lastPayload;
            socket.on('connect_error', (err) => {
                log.error(err.stack);
                assert.fail(`Error opening connection: ${err.stack}`);
            });
            socket.on('open', () => {
                const data = fs.readFileSync('./__tests__/integration/resources/valid.pdf');
                const buff = Buffer.from(data);
                socket.send(buff);
            });
            socket.on('message', (buffer) => {
                const payload: ValidationStatus = JSON.parse(buffer.toString());
                lastPayload = payload;
            });

            socket.on('close', () => {
                if (lastPayload?.validationComplete) {
                    done();
                } else {
                    assert.fail();
                }
            })
        });

        it('should validate a valid PDF document as valid', (done) => {
            const routeEndpoint = `ws://localhost:8888/pdf/v2/validate`;
            const socket = new WebSocket(routeEndpoint);
            socket.on('connect_error', (err) => {
                log.error(err.stack);
                assert.fail(`Error opening connection: ${err.stack}`);
            });
            socket.on('open', () => {
                const data = fs.readFileSync('./__tests__/integration/resources/valid.pdf');
                const buff = Buffer.from(data);
                socket.send(buff);
            });
            socket.on('message', (buffer) => {
                const payload: ValidationStatus = JSON.parse(buffer.toString());
                if (payload.validationComplete) {
                    if (payload.valid) {
                        done();
                    } else {
                        assert.fail(`Valid PDF should be evaluated as valid`);
                    }
                }
            });
        });

        it('should validate a non-PDF document as invalid', (done) => {
            const routeEndpoint = `ws://localhost:8888/pdf/v2/validate`;
            const socket = new WebSocket(routeEndpoint);
            socket.on('connect_error', (err) => {
                log.error(err.stack);
                assert.fail(`Error opening connection: ${err.stack}`);
            });
            socket.on('open', () => {
                const data = fs.readFileSync('./__tests__/integration/resources/invalid.pdf');
                const buff = Buffer.from(data);
                socket.send(buff);
            });
            socket.on('message', (buffer) => {
                const payload: ValidationStatus = JSON.parse(buffer.toString());
                if (payload.validationComplete) {
                    if (payload.valid === false) {
                        done();
                    } else {
                        assert.fail(`Valid PDF should be evaluated as valid`);
                    }
                }
            });
        });
    });

    after(() => {
        log.info('Closing test server');
        server.close();
    })
});
