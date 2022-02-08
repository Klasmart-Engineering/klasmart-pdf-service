import { NextFunction, Request, Response } from 'express'
import { withLogger } from '@kidsloop-global/kidsloop-nodejs-logger';

const log = withLogger('content-length-filter');

interface ContentLengthFilterParameters {
    maxLength: number
}

export function contentLengthFilter(params: ContentLengthFilterParameters) {
    return (request: Request, response: Response, next: NextFunction): void => {
        const length = parseInt(request.headers['content-length'] || '0');
        log.silly(`Validating content length of file with length ${length} less than ${params.maxLength}.`)
        if (length > params.maxLength) {
            log.warn(`User ${response.locals.token.id} (${response.locals.token.email}) sent request exceeding maximum length: ${length}/${params.maxLength}`)
            response.sendStatus(413);
            return;
        }
        next();
    }
}