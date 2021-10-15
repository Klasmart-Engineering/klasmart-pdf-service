import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';
import { withLogger } from 'kidsloop-nodejs-logger';

const log = withLogger('error-handler');

/**
 * Error handling middleware.  Transforms errors passed from service-level middleware to appropriate HTTP errors
 * to communicate back to the user.
 * @param error - The error object being passed with next somewhere previous. Can be type of HttpError or a standard Error object
 *  with an optional status code.  When an HttpError instance is passed, the HttpError is mapped directly to a response to the client.
 * In cases where the Error is not already a defined Http response through the HttpError, a check for the status property is attempted
 * and otherwise it will result in a 500 response.
 * @param request
 * @param response 
 * @param next 
 * @returns 
 */
export const errorHandler = (error: | HttpError | (Error & {status?: number}), request: Request, response: Response, next: NextFunction): void => {

    // In the case of an HttpError, map directly to an HTTP response
    if (error instanceof HttpError) {
        log.silly(error.stack);
        response.status(error.statusCode ?? error.status).send(error.message);
        next();
        return;
    }

    // In the Error message has a numeric status field, send that as the http response
    if (error.status && typeof error.status === 'number') {
        log.silly(error.stack);
        response.status(error.status).send(error.message);
        next();
        return;
    }

    // Log stack trace for unhandled, likely unexpected errors
    log.error(error.stack);
    // Otherwise respond with a 500
    response.status(500).send(error.message);
    next();
}
