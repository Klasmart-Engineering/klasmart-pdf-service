import { NextFunction, Request, Response } from 'express';
import { checkToken } from 'kidsloop-token-validation';
import { withLogger } from '../logger';
import { AuthType } from './Access';

const log = withLogger('kidsloop-auth-middleware');

export function kidsloopAuthMiddleware(): (request: Request, response: Response, next: NextFunction) => void {

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
            const authenticationDetails = await checkToken(token);
            log.silly(`Authenticated request from user with id: ${authenticationDetails.id}, email: ${authenticationDetails.email}`)
            response.locals.authenticated = true;
            response.locals.authType = AuthType.Authenticated;
            response.locals.token = authenticationDetails;
        } catch (err) {
            log.silly(`Unauthenticated request: Bad token`);
            response.locals.authenticated = false;
            response.locals.authType = AuthType.Anonymous;
        }
        next();
    }
}