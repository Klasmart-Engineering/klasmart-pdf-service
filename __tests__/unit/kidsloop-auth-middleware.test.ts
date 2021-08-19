import Sinon from 'sinon';
import { kidsloopAuthMiddleware } from '../../src/middleware/kidsloop-auth-middleware';
import * as kidsloopTokenValidation from 'kidsloop-token-validation';
import { Request, Response } from 'express';
import { expect } from 'chai';
import { AuthType } from '../../src/middleware/Access';
import rewire from 'rewire';


describe('kidsloop-auth-middleware', () => {
    describe('kidsloopAuthMiddleware', () => {
        const doAuthMiddleware = kidsloopAuthMiddleware();
        const sandbox = Sinon.createSandbox();
        const checkTokenStub = Sinon.stub();
        const kidsloopTokenValidationRewired = rewire('kidsloop-token-validation');
        kidsloopTokenValidationRewired.__set__('checkToken', checkTokenStub);

        let request: Request;
        let response: Response;
        let nextCallback: Sinon.SinonStub;

        beforeEach(() => {
            nextCallback = sandbox.stub();
            request = {
                cookies: {

                } 
            } as Request;

           response = {
               locals: {

               }
           } as Response;
        })

        afterEach(() => {
            sandbox.reset();
        });

        it('should set authType to anonymous and authenticated to false when request.cookies.access is falsy', () => {
            doAuthMiddleware(request, response, nextCallback);
            expect(response.locals.authType).to.equal(AuthType.Anonymous, 'should not be authenticated when no token is supplied');
            expect(response.locals.authenticated).to.be.false;
        });

        it.skip(`should set authType to Authenticated, authenticated to true, and token to jwt payload\
value when token is defined and valid`, async () => {
            request.cookies.access = 'some value';
            checkTokenStub.resolves({
                email: 'test@email.net',
                exp: 0,
                iss: 'test-issuer'
            });

            await doAuthMiddleware(request, response, nextCallback);

            expect(response.locals.authType).to.equal(AuthType.Anonymous, 'should be authenticated when token is processed successfully');
            expect(response.locals.authenticated).to.be.false;
            expect(response.locals.token).to.equal({});
        });

        it('should set authType to anonymous and authenticated to false when checkToken throws', async () => {
            request.cookies.access = 'some value';
            checkTokenStub.resolves({
                email: 'test@email.net',
                exp: 0,
                iss: 'test-issuer'
            });

            await doAuthMiddleware(request, response, nextCallback);

            expect(response.locals.authType).to.equal(AuthType.Anonymous, 'should be anonymous when token is invalid');
            expect(response.locals.authenticated).to.be.false;
            expect(response.locals.token).to.be.undefined;
        });

        describe('should always call next', () => {

        })
    });
});
