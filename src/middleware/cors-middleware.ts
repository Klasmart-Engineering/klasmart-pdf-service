import { withLogger } from 'kidsloop-nodejs-logger';
import { Request, Response, NextFunction } from 'express';

const log = withLogger('cors-middleware');
const serviceDomain = process.env.KL_DOMAIN as string;


/** Fail fast if service is in a production environment and missing required CORS configuration environment variable */
if (process.env.NODE_ENV === 'production' && !serviceDomain) {
    log.error(`Application missing required configuration for application domain. Without this configuration CORS cannot be configured to be accessible from service subdomains!`);
    throw new Error('Application missing required configuration for application domain. Without this configuration CORS cannot be configured to be accessible from service subdomains!')
}
log.info(`Configuring application CORS Access-Control-Allow-Origin to allow for ${serviceDomain} and subdomains of ${serviceDomain}`)

export function corsMiddleware(request: Request, response: Response, next: NextFunction): void {
    // No origin available (Service to service communication)
    if (!request.get('origin')) {
        response.set(`Access-Control-Allow-Origin`, serviceDomain);
        response.set(`Access-Control-Allow-Headers`, `Content-Type`);
    } else {
        // Origin defined, webpage interaction
        log.silly(`Checking origin ${request.get('origin')} to path ${request.path} for allowed CORS usage in the configured environment: ${serviceDomain} }`)
        const origin = new URL(request.get('origin') as string);
        console.log(origin);
        if (origin.hostname.endsWith(serviceDomain)) {
            response.set(`Access-Control-Allow-Origin`, origin.origin);
        } else {
            response.set(`Access-Control-Allow-Origin`, serviceDomain);
        }
        response.set(`Access-Control-Allow-Headers`, `Content-Type`);
    }
    next();
}
