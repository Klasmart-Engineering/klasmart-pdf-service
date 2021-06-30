import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';

export const errorHandler = (error: | HttpError | (Error & {status?: number}), request: Request, response: Response, next: NextFunction): void => {
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