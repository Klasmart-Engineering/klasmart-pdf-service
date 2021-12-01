import { corsMiddleware } from '../../../src/middleware/cors-middleware';
import { NextFunction, Request, Response } from 'express';
import { expect } from 'chai';


const defaultDomain = 'kidsloop.dev';
const defaultOrigin = `https://${defaultDomain}`;
const originalDomain = process.env.KL_DOMAIN;

const configureRequest = (origin: string): [Request, Response] => {
    const request = new Map<string, string>();
    const response = new Map<string, string>();
    request.set('origin', origin);

    return [
        request as unknown as Request,
        response as unknown as Response
    ]
}

function withDomain(domain: string, test: () => void) {
    const prevKlDomain = process.env.KL_DOMAIN;
    process.env.KL_DOMAIN = domain;
    test();
    process.env.KL_DOMAIN = prevKlDomain;
}

let corsHandler: (request: Request, response: Response, next: NextFunction) => void;

describe('cors-middleware', () => {
    before(() => {
        process.env.KL_DOMAIN = defaultDomain;
        corsHandler = corsMiddleware();
    })

    after(() => {
        process.env.KL_DOMAIN = originalDomain;
    })

    it('should throw when NODE_ENV is production and KL_DOMAIN is falsy', () => {
        const prevNodeEnv = process.env.NODE_ENV;
        const prevKlDomain = process.env.KL_DOMAIN;

        process.env.NODE_ENV = 'production';
        process.env.KL_DOMAIN = '';

        expect(corsMiddleware).to.throw;

        process.env.NODE_ENV = prevNodeEnv;
        process.env.KL_DOMAIN = prevKlDomain;
    });

    it('should set default domain when no origin is provided', () => {
        const [ request, response ] = configureRequest(undefined);

        corsHandler(request, response, () => {})
        expect(response.get('Access-Control-Allow-Origin')).to.equal(defaultOrigin);
    });

    it('should work across different ports in the same domain', () => {
        withDomain('localhost:23894', () => {
            const origin = 'https://localhost:8080';
            const [ request, response ] = configureRequest(origin);
            corsMiddleware()(request, response, () => {});
            expect(response.get(`Access-Control-Allow-Origin`)).to.equal(origin);
        })
    })

    describe('should subdomain address when subdomain is of origin', () => {
        const origins = ['api', 'h5p', 'auth', 'live', 'hub', 'app', 'test', 'dev', 'etc', 's3']
            .map(subdomain => [
                `http://${subdomain}.${defaultDomain}`,
                `https://${subdomain}.${defaultDomain}` 
            ])
            .flatMap(arr=>arr);

        origins.forEach(origin => {
            it(origin, () => {
                const [ request, response ] = configureRequest(origin);

                corsHandler(request, response, () => {});
                expect(response.get('Access-Control-Allow-Origin')).to.equal(origin);
            });
        });
    });

    describe('should set default domain when an origin is provided but does not match the default domain', () => {
        const nonMatchingOrigins = [
            'http://google.com',
            'https://live.kidslooop.dev',
            'https://live.kidsloop.com',
            'https://api.microsoft.com',
            'https://h5p.org'
        ]

        nonMatchingOrigins.forEach(origin => {
            it(origin, () => {
                const [ request, response ] = configureRequest(origin);

                corsHandler(request, response, () => {});
                expect(response.get('Access-Control-Allow-Origin')).to.equal(defaultOrigin);
            });
        })
    })
});