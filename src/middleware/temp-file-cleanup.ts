import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import { withLogger } from '../logger';

const log = withLogger('temp-file-cleanup');

/**
 * Middleware functiont to cleanup temp files.
 * Temporary file paths can be added to the locals.tempFiles 
 * value while processing a request. After the main middleware
 * is completed, the cleanupTempFiles middleware can be hooked
 * in to cleanup the file
 */
export function cleanupTempFile() {
    return async (request: Request, response: Response, next: NextFunction): Promise<void> => {        
        if (!response.locals.tempFiles) {
            next();
            return;
        }

        if (typeof response.locals.tempFiles === 'string') {
            try {
                log.debug(`Cleaning up temp file: ${response.locals.tempFiles}`)
                await fs.promises.rm(response.locals.tempFiles);
            } catch (err) {
                log.error(`Error attempting to cleanup temp file ${response.locals.tempFiles}: ${err.message}`);
                console.log(err);
            }
            next();
            return;
        }

        const promises = (response.locals.tempFiles as string[])
            .map((filename, i) => {
                log.debug(`Cleaning up temp file ${i+1}/${response.locals.tempFiles.length}: ${filename}`)
                fs.promises.rm(filename)
            });

        try {
            await Promise.all(promises);
        } catch (err) {
            log.error(`Error attemping to cleanup temp files: ${response.locals.tempFiles}: ${err.message}`);
            console.log(err);
        }
        next();
        return;
    }
}