import fs from 'fs';
import { v4 as uuidV4 } from 'uuid';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import * as pdfService from '../pdf-service';
import { withLogger } from 'kidsloop-nodejs-logger';
import { ValidationStatus } from '../interfaces/validation-status';
import { PassThrough } from 'stream';

const log = withLogger('pdf-ws');

const TEMPORARY_FILE_LOCATION = './temp';

async function configure() {
    if (!fs.existsSync(TEMPORARY_FILE_LOCATION)) {
        log.info(`Creating temporary file directory at: ${TEMPORARY_FILE_LOCATION}`)
        fs.mkdirSync(TEMPORARY_FILE_LOCATION);
    } else { log.silly(`Temporary file directory at ${TEMPORARY_FILE_LOCATION} already exists, skipping creation.`); }
}

export type PDFValidationUpdateCallback = (data: ValidationStatus) => void;

export async function validatePDF(connection: WebSocket, connectionRequest: IncomingMessage): Promise<void> {
    // Expecting binary data from client
    connection.binaryType = 'arraybuffer';
    const key = uuidV4();
    const fileLocation = `${TEMPORARY_FILE_LOCATION}/${key}.pdf`;
    const stream = fs.createWriteStream(fileLocation);
    await new Promise((resolve, reject) => {
        connection.on('message', async (arrayBuffer: ArrayBuffer) => {
            stream.on('error', reject);
            const bufferedData = Buffer.from(arrayBuffer);
            log.info(`Receiving data with length ${bufferedData.byteLength}`);
            const inputStream = new PassThrough();
            inputStream.on('end', resolve);
            inputStream.end(bufferedData);
            inputStream.pipe(stream);
        });
    });

    const validationUpdateCallback: PDFValidationUpdateCallback = (data: ValidationStatus) => connection.send(JSON.stringify(data));

    await pdfService.validatePDFWithStatusCallback(key, fileLocation, validationUpdateCallback);

    connection.close();
    log.debug(`Removing terporary file at ${fileLocation}`);
    try {
        fs.rmSync(fileLocation);
    } catch (err) {
        log.error(`Error removing temporary file with key ${key}: ${err.stack}`);
    }
}

(async () => await configure())();