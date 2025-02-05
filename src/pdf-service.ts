import { getManager } from 'typeorm';
import { PDFMetadata } from './models/PDFMetadata'
import * as imageConverter from './image-converter';
import { ValidationResult } from './image-converter';
import * as s3Service from './s3-client';
import NodeCache from 'node-cache';
import createError, { HttpError } from 'http-errors';
import { Readable } from 'stream';
import { withLogger } from '@kl-engineering/kidsloop-nodejs-logger';
import fs from 'fs';
import { JPEGStream } from 'canvas';
import crypto from 'crypto';
import createHttpError from 'http-errors';
import { v4 as uuidV4 } from 'uuid';
import { Request } from 'express';
import { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import { PDFDocumentProxy, } from 'pdfjs-dist/types/src/display/api';
import { ValidationStatus } from './interfaces/validation-status';
import { PDFValidationUpdateCallback } from './ws/pdf-ws';
import { getAdaptedOutline } from './pdf/pdf-outline-builder';
import { mapModelToDTO, PDFMetadataDTO } from './dto/PDFMetadataDTO';

const log = withLogger('pdf-service');

let pageResolutionCache: NodeCache;

const defaultCacheProps = {
    stdTTL: 100,
    checkperiod: 60,
    deleteOnExpire: true
}

/**
 * Provides configuration for the PDF service
 * @param cache - Provided NodeCache. Will use a default configuration if not provided
 */
export function initialize(
    pageResolutionCacheInput: NodeCache = new NodeCache(defaultCacheProps),
): void {
    pageResolutionCache = pageResolutionCacheInput;
    
    if (process.env.CMS_BASE_URL) {
        log.info(`Registering CMS asset location: ${process.env.CMS_BASE_URL}`)
    } else {
        log.warn(`CMS_BASE_URL not configured! PDF resource locations may be unreachable!`);
    }
}

export async function validateCMSPDF(pathPrefix: string,pdfName: string) : Promise<ValidationResult> {
    const config: DocumentInitParameters = {
        url: createCMSURL(pdfName, pathPrefix)
    };
    return imageConverter.validatePDFTextContent(config);
}

/**
 * Service level function for managing validation of PDF documents from a posted binary payload.
 * Function streams file data to a temporary file, then reading the temporary file data to a Uint8Array
 * that is passed to pdf.js.  While pdf.js processes it the file data is also passed to a hash function
 * which calculates a hash (as required by infosec)
 * @param request 
 * @param registerTempFile 
 * @returns 
 */
export async function validatePostedPDF(request: Request, registerTempFile: (filename: string) => void): Promise<ValidationResult> {
    const length = request.headers['content-length'] ? parseInt(request.headers['content-length']) : undefined;
    
    // Write file data to temp file
    const tempFileName = `${uuidV4()}.pdf`;
    log.debug(`Temporarily writing file with length ${length} to file system as ${tempFileName}`)
    const writeStream = fs.createWriteStream(tempFileName);
    registerTempFile(tempFileName);
    
    // Await temp file write
    await new Promise<void>((resolve, reject) => {
        request
        .pipe(writeStream)
        .on('close', () => {
            log.silly(`Temporary file (${tempFileName}) successfully written.`);
            resolve();
        })
        .on('error', (err) => {
            log.error(`Error streaming request payload to temporary file: ${err.message}`);
            reject(err);
        });
    });
    
    const filedata = await fs.promises.readFile(tempFileName);
    const data = Uint8Array.from(filedata);

    // Create config for validator
    const config: DocumentInitParameters = {
        data
    }

    // Start Validation Check
    const validPromise = imageConverter.validatePDFTextContent(config);

    // Start Hash Calculation
    const hash = crypto.createHash('md5');
    hash.setEncoding('hex');
    const hashPromise = new Promise<string | undefined>((resolve, reject) => {
        fs.createReadStream(tempFileName)
            .on('end', () => {
                hash.end();
                const digest = hash.read();
                log.verbose(`Hash calculation for document ${tempFileName} complete: ${digest}`)
                resolve(digest);
            })
            .on('error', (err) => {
                log.error(`Error calculating file hash: ${err.message}`)
                reject(err);
            })
            .pipe(hash)
    });

    // Wait for both Validation and Hash calculation to complete
    const [valid, hashString] = await Promise.all([validPromise, hashPromise]);

    // Return values
    return { ...valid, hash: hashString, length };
}

export async function validatePDFWithStatusCallbackByContentId(contentId: string, updateCallback: PDFValidationUpdateCallback, cmsPath = "assets"): Promise<void> {
    const url = createCMSURL(contentId, cmsPath);
    log.debug(`Creating document load function for document at ${url.toString()}`)
    const loadDocument = async () => imageConverter.createDocumentFromUrl(url, true);
    await validatePDFWithStatusCallback(contentId, loadDocument, updateCallback);
}

export async function validatePostedPDFWithStatusCallback(key: string, fileLocation: string, updateCallback: PDFValidationUpdateCallback): Promise<void> {
    const loadDocument = async () => imageConverter.createDocumentFromOS(fileLocation, true);
    await validatePDFWithStatusCallback(key, loadDocument, updateCallback);
}

/**
 * Validates a PDF Documents structure by rendering each page. Function
 * communicates validation status by calling a provided callback function
 * with an instance of ValidationStatus as an argument.
 * Loads, reloads document data using a provided loadDocument function.
 * 
 * @param key - Identifying key for the document, may be a canonical name or generated ID
 * @param loadDocument - Callback function that resolves to a PDFDocumentProxy
 * @param updateCallback - Callback function which is called when ValidationStatus is updated
 * @returns 
 */
async function validatePDFWithStatusCallback(key: string, loadDocument: () => Promise<PDFDocumentProxy>, updateCallback: PDFValidationUpdateCallback) {
    const documentReloadFrequency = 20;

    let document: PDFDocumentProxy;
    try {
        document = await loadDocument();
    } catch (err) {
        log.verbose(`PDF Document metadata read failure thrown by pdf.js: ${err.message}`)
        // Immediate failure case, document is corrupt or not a PDF document 
        updateCallback({
            key,
            pagesValidated: 0,
            totalPages: undefined,
            valid: false,
            validationComplete: true
        });
        return;
    }
    
    const pages = document.numPages;
    const validationStatus: ValidationStatus = {
        key,
        pagesValidated: 0,
        totalPages: pages,
        valid: undefined,
        validationComplete: false
    };
    log.verbose(`Beginning validation check of ${pages} pages for PDF with key ${key}`)

    for(let i = 1; i <= pages; i++) {
        log.silly(`Validating page ${i} for pdf with key: ${key}`)
        if (i % documentReloadFrequency === 0) document = await loadDocument();
        try {
            await imageConverter.generatePageImage(document, i);
            validationStatus.pagesValidated = i;
            updateCallback({ ...validationStatus });
        } catch (err) {
            log.verbose(`Validation failure for document with key ${key} on page ${i}: ${err.stack}`)
            validationStatus.valid = false;
            validationStatus.validationComplete = true;
            updateCallback({ ...validationStatus });
            return;
        }
    }
    validationStatus.valid = true;
    validationStatus.validationComplete = true;
    log.verbose(`PDF with key: ${key} determined valid.`);
    updateCallback({ ...validationStatus });
}

export async function getPDFPages(pathPrefix: string, pdfName: string):Promise<number> {
    const pdfURL = new URL(createCMSURL(pdfName, pathPrefix));
    log.debug(`Request for PDF pages for PDF located at ${pdfURL.toString()}.`)
    let existingMetadata;
    try {
        const em = getManager();
        log.debug('Checking for existing metadata');
        existingMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
    } catch (err) {
        log.error(`Error while attempting to retrieve metadata from the database: ${err.message}`);
        throw createError(500, err.message, err);
    }
        
    if (existingMetadata) return existingMetadata.totalPages;

    log.debug('No pre-existing metadata found. Initializing');
    const { pdfMetadata } = await initializeMetadata(pdfURL);

    return pdfMetadata.totalPages;
}

/**
 * Function for retrieving document metadata
 * @param pdfName 
 * @returns 
 */
export async function getPDFMetadata(path: string, pdfName: string): Promise<PDFMetadataDTO> {
    try {
        const em = getManager();
        let rawMetadata = await em.findOne(PDFMetadata, pdfName);

        // If metadata has not been generated yet, generate it
        if (!rawMetadata) {
            log.debug(`Metadata record for ${pdfName} not found in database, attempting to generate`);
            const url = createCMSURL(pdfName, path);
            ({ pdfMetadata: rawMetadata } = await initializeMetadata(new URL(url)));
        }

        // Map the internal data representation to the desired client facing format
        return mapModelToDTO(rawMetadata);
    } catch (err) {
        log.error(`Error retrieving document metadata: ${err.stack}`)
        throw err;
    }
}

/**
 * Function to generate and store images from a PDF - intended to be used to hook into the 
 * CMS upload process to pre-generate images
 * @param pdfName 
 * @param pdfURL
 * @param accepted - Function, call when the response is ready to be accepted 
 */
export async function prerenderDocument(pathPrefix: string, pdfName: string, accepted: () => void, reject: (err: Error) => void): Promise<void> {
    let pages: number;
    try {
        pages = await getPDFPages(pathPrefix, pdfName);
        accepted();
    } catch(err) {
        // PDF document is invalid or missing, fail fast and alert user
        reject(err);
        return;
    }
    for(let i = 1; i <= pages; i++) {
        try {
            const stream = await getPDFPage(pdfName, i, pathPrefix);
            // Destroy stream so that .close listeners fire
            stream.destroy();
        } catch (err) {
            log.error(`Error prerendering document: ${err.message}`);
        }
    }
} 

/* Produces the page key for the pdf, then attempts to load it from s3.
    If the object is not in S3, then the application will check the page cache. If the pageKey is found in the cache, 
    then it will await page creation and then read the page image.
    If the pageKey is not in the cache it will add it to the cache and then load the PDF, generate an image for the page and save it to S3,
        then return a stream for this image
*/
export async function getPDFPage(pdfName: string, page: number, pathPrefix = 'assets'): Promise<Readable> {
    const pdfURL = new URL(createCMSURL(pdfName, pathPrefix));
    const pageKey = mapPageKey(pdfURL, pdfName, page);
    let pageStream: Readable | undefined;
    
    try {
        pageStream = await s3Service.readObject(pageKey);
    } catch (err) {
        // 404/403 errors are expected here, so don't rethrow these
        if (!(err instanceof HttpError)) {
            // We can probably continue here, this error may indicate a problem but won't prevent us from trying other things
            log.warn(`Unexpected error in initial S3 request while checking existence for page ${page} of PDF ${pdfName} located at ${pdfURL}: ${err.message}`);
        } else if (![403, 404].includes(err.status)) {
            log.debug(`Page render for page ${page} of ${pdfName} not found on S3.`);
            throw err;
        } else {
            log.warn(`Unexpected HTTP error in initial S3 request for page ${page} of ${pdfName}: ${err.message}`);
        }
    }

    if (pageStream) return pageStream;
    
    if (pageResolutionCache.has(pageKey)) {
        log.debug(`Page key for page ${page} of ${pdfName} found in cache, awaiting resolution if not already resolved`);
        await pageResolutionCache.get(pageKey);
        log.debug(`Resolved, page ${page} of ${pdfName} is prerendered`);
        const stream = await s3Service.readObject(pageKey);
        if (stream) return stream;
    } else {
        log.debug(`Page key for page ${page} of ${pdfName} not found in cache.`);
    }

    let stream;
    try {
        const tempFilename = await renderSinglePage(pageKey, pdfURL, page);
        // stream = await s3Service.readObject(pageKey);
        stream = fs.createReadStream(tempFilename);
        stream.on('close', () => {
            log.debug(`Removing temporary file: ${tempFilename}`);
            fs.promises.rm(tempFilename)
                .catch(err => {
                    log.error(`Error removing temporary file: ${tempFilename} for page ${page} of ${pdfName}. Caused by: ${err.stack}`);
                })
        });
    } catch (err) {
        log.error(`Error rendering PDF page: ${err.message}`)
        if (err instanceof HttpError) throw err;

        // Delete key, as data may not actually be available due to error
        pageResolutionCache.del(pageKey);
        throw createError(500, err.message);
    } 
    if (!stream) throw createHttpError(500, 'Unable to retrieve object after write.');
    return stream;
}

export async function getDirectPageRender(page: number, pathPrefix: string, pdfName: string): Promise<JPEGStream> {
    const pdfURL = new URL(createCMSURL(pdfName, pathPrefix));
    log.debug(`Rendering page ${page} from document located at ${pdfURL.toString()}`)
    const document = await imageConverter.createDocumentFromUrl(pdfURL.toString());
    return imageConverter.generatePageImage(document, page);
}

async function renderSinglePage(pageKey: string, pdfURL: URL, page: number): Promise<string> {
    // Async code invoked via IIFE to allow immediate access of the promise to the cache
    const promise = (async () => {
        const em = getManager();
        const pdfMetadata = await em.findOne(PDFMetadata, pdfURL.toString().toLowerCase());
        if (!pdfMetadata) throw createError(400, `PDF metadata not found. PDF must be processed using '.../pages?...' before pages can be loaded.`);
        
        if (pdfMetadata.totalPages < page) {
            throw createError(404, `Document ${pdfURL} does not contain page: ${page}`)
        }
        
        const document = await imageConverter.createDocumentFromUrl(pdfURL.toString());

        const jpegStream = await imageConverter.generatePageImage(document, page);

        const randPrefix = Buffer.from(crypto.randomBytes(16)).toString('hex');
        const filename = `./${randPrefix}-${pageKey.replace('/', '-')}`;
        let contentLength: number;
        let stat;
        try {
            contentLength = await writeStreamToTempFile(filename, jpegStream);
            log.debug(`Bytes written for ${pageKey}: ${contentLength}`);
            stat = await fs.promises.stat(filename);
            log.debug(`Filesize for ${pageKey}: ${stat.size}`);
        } catch (err) {
            log.error(`Error writing image page ${page} of PDF located at ${pdfURL} to temporary file: ${err.message}`);
            throw createError(500, err.message);
        }

        log.info('Reading temp file from file system');
        const readStream = fs.createReadStream(filename);

        log.info('Sending data to S3');
        
        try {
            await s3Service.simpleWriteObject(pageKey, readStream);
        } catch (err) {
            // ! Note: HttpErrors will be propagated, but any other error types will only be
            // ! logged, as the requested image can still be successfully served from the temp
            // ! file. While it would be better to persist the image, failing to do so will not
            // ! prevent us from succcessfully serving the image to the user.
            if (err instanceof HttpError) throw err;
            log.error(`Error writing PDF from ${pdfURL} file to S3 with key: ${pageKey}.`);
            log.error(JSON.stringify(err));
        }
        return filename;
    })();
    pageResolutionCache.set(pageKey, promise);

    return promise;
}

async function writeStreamToTempFile (filename: string, stream: JPEGStream): Promise<number> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filename);
        stream
            .on('end', async () => {
                log.debug(`Completed write to temporary file for file: ${filename}`);
                const contentLength = fileStream.bytesWritten;
                log.debug(`contentLength of file ${filename}: ${contentLength}`)
                resolve(contentLength);
            })
            .on('error', (err) => {
                log.error(`Error reading from JPEGStream while streaming to temporary file: ${err.message}`)
                reject(err);
            })
            .pipe(fileStream)
            .on('error', (err) => {
                log.error(`Error raised by WriteFileStream while streaming to temporary file: ${err.message}`)
                reject(err);
            });

        log.debug(`Piping data to temporary file ${filename}`);
    });
}

/**
 *  Initializes metadata for the first read of a PDF 
 *  @returns Object containing metadata and pdfjs document
**/
async function initializeMetadata(pdfURL: URL) {
    log.debug(`Creating document for pdf located at ${pdfURL.toString()}`); 
    let pdfMetadata: PDFMetadata | undefined;
    try {
        const document = await imageConverter.createDocumentFromUrl(pdfURL.toString());
        const pages = document.numPages;
        const outline = await getAdaptedOutline(document);
        const pageIndexes = await document.getPageLabels() || undefined;
        const url = pdfURL.toString().toLowerCase();
        log.debug(`${pages} detected for PDF at ${pdfURL}.`)
        pdfMetadata = new PDFMetadata(url, pages, 0, outline, pageIndexes);
        
        // Replace unicode null - see KLL-3119 for details
        const json = JSON.stringify(pdfMetadata).replace(/\\u0000/g, '');
        pdfMetadata = JSON.parse(json) as PDFMetadata;

        log.debug(`Storing metadata for PDF at ${pdfURL}`)


        await getManager().save(PDFMetadata, pdfMetadata);
        log.debug(`PDF metadata initialization complete for PDF at ${pdfURL}`);
        return { pdfMetadata, document };
    } catch (err) {
        log.error(`Error initializing page metadata for PDF at ${pdfURL}: ${err.message}`, err);
        log.debug(`Erroring payload: ${JSON.stringify(pdfMetadata)}`)
        if (err instanceof HttpError) throw err;
        throw createHttpError(500, err);
    }
}

export const mapPageKey = (pdfURL: URL, pdfName: string, page: number): string => {
    log.silly(`Creating page key for pdf with URL: ${pdfURL}, name: ${pdfName}, and page: ${page}`)
    const hash = crypto.createHash('sha512');
    hash.update(Buffer.from(pdfURL.toString().toUpperCase()));
    const digest = hash.digest().toString('hex');
    return `${pdfName.toLowerCase()}-${digest}/${page}.jpeg`;
}

export function createCMSURL(contentId: string, pathPrefix = 'assets'): string {
    return `${process.env.CMS_BASE_URL}/${pathPrefix}/${contentId}`;
}