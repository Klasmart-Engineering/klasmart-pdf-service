import { NextFunction, Request, Response } from 'express'
import { withLogger } from '@kidsloop-global/kidsloop-nodejs-logger';
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
        response.locals.authChecked = true;
        
        if (response.locals.authType === AuthType.Any) {
            log.error('AuthType.Any is offered as a convenience for route authorization configuration. A user\'s access level should never resolve to any!');
            next(new Error(`Invalid user authorization level: ${AuthType.Any}`));
            return;
        }

        // Assign authtype based on authentication data - normally this would be done in the authentication
        // workflow, but as that has been abstracted it is being done here out of convenience
        log.info(JSON.stringify(response.locals));
        if (!response.locals.authType) {
            log.silly('Setting authType');
            if (response.locals.authenticated === undefined) {
                log.warn('No auth type information provided! Assuming anonymous');
            }
            response.locals.authType = response.locals.authenticated ? AuthType.Authenticated : AuthType.Anonymous;
        }
        

        // Check if this action is available to any user
        if (types.includes(AuthType.Any)) {
            log.silly(`Allowing access to open route`);
            next();
            return;
        }

        // Check if the auth type matches the action requirement
        if (types.includes(response.locals.authType)) {
            log.silly(`Allowing access to user with status ${response.locals.authType} to route accessible to: ${types}`)
            next();
            return;
        }

        const errorCode = response.locals.authType === AuthType.Anonymous 
            ? 401
            : 403;
        log.silly(`Passing authorization status error with code ${errorCode} to error handler`);
        next(createError(errorCode));        
    }
}
