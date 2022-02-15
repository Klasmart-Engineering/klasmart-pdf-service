import { withLogger } from '@kl-engineering/kidsloop-nodejs-logger';
import { Request, Response, NextFunction } from 'express';

const log = withLogger('cors-middleware');

export function corsMiddleware(): (request: Request, response: Response, next: NextFunction) => void {
    
    /** Fail fast if service is in a production environment and missing required CORS configuration environment variable */
    if (process.env.NODE_ENV === 'production' && !process.env.KL_DOMAIN) {
        log.error(`Application missing required configuration for application domain. Without this configuration CORS cannot be configured to be accessible from service subdomains!`);
        throw new Error('Application missing required configuration for application domain. Without this configuration CORS cannot be configured to be accessible from service subdomains!')
    }
    log.info(`Configuring application CORS Access-Control-Allow-Origin to allow for ${process.env.KL_DOMAIN} and subdomains of ${process.env.KL_DOMAIN}`)
    const defaultServiceUrl = new URL(`https://${process.env.KL_DOMAIN}`);
    
    return function corsHandler(request: Request, response: Response, next: NextFunction): void {
    
        // No origin available (Service to service communication)
        if (!request.get('origin')) {
            log.silly(`origin header not found`)
            response.set(`Access-Control-Allow-Origin`, defaultServiceUrl.origin);
        } else {
            // Origin defined, webpage interaction
            log.silly(`Checking origin ${request.get('origin')} to path ${request.path} for allowed CORS usage in the configured environment: ${defaultServiceUrl.host} }`)
            const origin = new URL(request.get('origin') as string);
            if (origin.hostname.endsWith(defaultServiceUrl.hostname)) {
                response.set(`Access-Control-Allow-Origin`, origin.origin);
            } else {
                response.set(`Access-Control-Allow-Origin`, defaultServiceUrl.origin);
            }
        }
        response.set(`Access-Control-Allow-Headers`, `Content-Type`);
        response.set(`Access-Control-Allow-Credentials`, 'true');
        next();
    }
}
