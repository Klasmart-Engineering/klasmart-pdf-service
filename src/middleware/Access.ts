import { NextFunction, Request, Response } from 'express'
import { withLogger } from '../logger';
import createError from 'http-errors';

const log = withLogger('Access');

export enum AuthType {
    Anonymous = "ANONYMOUS",
    Authenticated = "AUTHENTICATED",
    Cloudfront = "CLOUDFRONT",
    Any = "ANY",
}

export function Authorized(...types: AuthType[]) {
    return (request: Request, response: Response, next: NextFunction): void => {
        // Check if this action is available to any user
        response.locals.authChecked = true;
        
        if (types.includes(AuthType.Any)) {
            next();
            return;
        }

        if (!response.locals.authType) {
            log.warn('No auth type information provided! Assuming anonymous');
            response.locals.authType = AuthType.Anonymous;
            next();
            return;
        }

        // Check if the auth type matches the action requirement
        if (types.includes(response.locals.authType)) {
            next();
            return;
        }

        const errorCode = response.locals.authType === AuthType.Anonymous 
            ? 401
            : 403;

        next(createError(errorCode));        
    }
}