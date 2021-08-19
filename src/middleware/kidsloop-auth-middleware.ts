import { NextFunction, Request, Response } from 'express';
import * as kidsloopTokenValidation from 'kidsloop-token-validation';
import { withLogger } from '../logger';
import { AuthType } from './Access';

const log = withLogger('kidsloop-auth-middleware');

/**
 * Creates middleware function that authenticates users based on Kidsloop access token
 * Token processing is handled by the kidsloop-token-validation module. Based on the token
 * validation an AuthType will be registered on response.locals for use in later processing.
 * 
 * At the current time the access token does not seem to include any privilege or access level
 * information so it only assigns AuthType.Authenticated and AuthType.Anonymous.
 * 
 * In development environments, the environment variable DEV_JWT_SECRET can be registered for 
 * testing JWT integration, but in the production environment the JWT secret is provided by the
 * kidsloop-token-validation module.
 */
export function kidsloopAuthMiddleware(): (request: Request, response: Response, next: NextFunction) => Promise<void> {

    if (process.env.DEV_JWT_SECRET) {
        log.warn(`Running with development JWT secret!`);
    }

    return async (request: Request, response: Response, next: NextFunction): Promise<void> => {        

        const token = request.cookies.access as string;
        if (!token) {
            log.silly(`Unauthenticated request: No token`);
            response.locals.authType = AuthType.Anonymous;
            response.locals.authenticated = false;
            next();
            return;
        }

        try {
            const authenticationDetails = await kidsloopTokenValidation.checkToken(token);
            log.silly(`Authenticated request from user with id: ${authenticationDetails.id}, email: ${authenticationDetails.email}`);
            response.locals.authType = AuthType.Authenticated;
            response.locals.authenticated = true;
            response.locals.token = authenticationDetails;
        } catch (err) {
            log.silly(`Unauthenticated request: Bad token - ${err.message}`);
            response.locals.authenticated = false;
            response.locals.authType = AuthType.Anonymous;
        }
        next();
    }
}