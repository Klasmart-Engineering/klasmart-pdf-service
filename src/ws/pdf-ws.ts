import fs from 'fs';
import { v4 as uuidV4 } from 'uuid';
import WebSocket from 'ws';
import * as pdfService from '../pdf-service';
import { withLogger } from '@kidsloop-global/kidsloop-nodejs-logger';
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

/**
 * Web socket interfacing method for PDF validation
 * This function will read arraybuffer data sent from the client via the
 * web socket connection into a temporary file. It will create a callback for
 * reporting validation status via the websocket and then delegate validation
 * to the service-level validation function. The connection is closed when the
 * servie level function completes.
 * @param connection - Websocket connection
 */
export async function validatePDF(connection: WebSocket): Promise<void> {
    // Expecting binary data from client
    connection.binaryType = 'arraybuffer';
    const key = uuidV4();
    const fileLocation = `${TEMPORARY_FILE_LOCATION}/${key}.pdf`;
    const stream = fs.createWriteStream(fileLocation);
    try {
        await new Promise((resolve, reject) => {
            connection.on('message', async (arrayBuffer: ArrayBuffer) => {
                stream.on('error', reject);
                const bufferedData = Buffer.from(arrayBuffer);
                log.verbose(`Receiving ws data with length ${bufferedData.byteLength}`);
                const inputStream = new PassThrough();
                inputStream.on('end', resolve);
                inputStream.end(bufferedData);
                inputStream.pipe(stream);
            });
        });
    } catch (err) {
        log.error(err.stack);
    }
    const validationUpdateCallback: PDFValidationUpdateCallback = (data: ValidationStatus) => connection.send(JSON.stringify(data));

    await pdfService.validatePostedPDFWithStatusCallback(key, fileLocation, validationUpdateCallback);

    connection.close();
    log.verbose(`Removing temporary file at ${fileLocation}`);
    try {
        fs.rmSync(fileLocation);
    } catch (err) {
        log.error(`Error removing temporary file with key ${key}: ${err.stack}`);
    }
}

export async function validatePDFByContentId(connection: WebSocket, cmsPath: string, contentId: string): Promise<void> {
    const validationUpdateCallback: PDFValidationUpdateCallback = (data: ValidationStatus) => connection.send(JSON.stringify(data));

    await pdfService.validatePDFWithStatusCallbackByContentId(contentId, validationUpdateCallback, cmsPath);
    connection.close();
}

(async () => await configure())();
