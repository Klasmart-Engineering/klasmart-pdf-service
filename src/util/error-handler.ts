import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';
import { withLogger } from '../logger';

const log = withLogger('error-handler');

export const errorHandler = (error: | HttpError | (Error & {status?: number}), request: Request, response: Response, next: NextFunction): void => {
    
    log.error(error);

    if (error instanceof HttpError) {
        response.status(error.statusCode ?? error.status).send(error.message);
        next();
        return;
    }
    if (error.status) {
        response.status(error.status).send(error.message);
        next();
        return;
    }
    response.status(500).send(error.message);
    next();
}
