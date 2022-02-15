import { NextFunction, Request, Response } from 'express';
import { withLogger } from '@kl-engineering/kidsloop-nodejs-logger';

const log = withLogger('ContentTypeFilter');

export function AllowedContentTypes(...types: string[]) {
    return (request: Request, response: Response, next: NextFunction): void => {
        const incomingType = request.headers['content-type'];

        if (!types || types.length === 0) {
            log.warn('Content type filter is registered without any acceptable types! All requests are being rejected!')
            fail(response);
            return;
        }

        if (incomingType && types.includes(incomingType)) {
            log.silly(`Request for ${request.path} has acceptable content type.`)
            next();
        } else {
            log.debug(`Request for ${request.path} is being rejected as it has content type ${incomingType} which is not included in allowed content types: ${types}`);
            fail(response);
        }
    }
}

const fail = ((response: Response) => {
    response.sendStatus(415);
})