import { Request, Response } from 'express';
import { Authorized, AuthType } from '../../../src/middleware/Access';
import Sinon from 'sinon';
import { expect } from 'chai';
import { HttpError } from 'http-errors';

describe('Access', () => {
    const createResponse = () => ({
        locals: { }
    } as unknown as Response);
    
    const createRequest = () => ({} as unknown as Request);

    let request: Request;
    let response: Response;
    let next = Sinon.stub();

    beforeEach(() => {
        request = createRequest();
        response = createResponse();
        next.resetHistory();
    });

    const authTypes = [AuthType.Anonymous, AuthType.Any, AuthType.Authenticated, AuthType.Cloudfront];

    describe('Authorized', () => {
        it('should call next with non-HTTP error when user has authType registered as Any', () => {
            const testFunction = Authorized(AuthType.Authenticated);
            response.locals.authType = AuthType.Any;
            testFunction(request, response, next);
            expect(next.firstCall.firstArg)
                .to.be.instanceOf(Error, 'next should be passed an error')
                .and.to.not.be.instanceOf(HttpError, 'next should be passed a generic error that is not a type of HttpError');

        })

        it('should set authType to Authenticated when response.locals.authenticated is true and authType is not already set', () => {
            const testFunction = Authorized(AuthType.Any);
            response.locals.authenticated = true;
            testFunction(request, response, next);
            expect(response.locals.authType).to.equal(AuthType.Authenticated)
        });

        it('should set authType to Anonymous when response.locals.authenticated is false and authType is not already set', () => {
            const testFunction = Authorized(AuthType.Any);
            response.locals.authenticated = false;
            testFunction(request, response, next);
            expect(response.locals.authType).to.equal(AuthType.Anonymous)
        });
        

        describe('should always set response.locals.authChecked to true', () => {
            const inputs = [
                [AuthType.Any],
                [AuthType.Anonymous],
                [AuthType.Authenticated],
                [AuthType.Cloudfront],
                [AuthType.Any, AuthType.Authenticated],
                [AuthType.Anonymous, AuthType.Authenticated],
                [],
                [AuthType.Cloudfront, AuthType.Any, AuthType.Anonymous, AuthType.Authenticated],
                [AuthType.Cloudfront, AuthType.Cloudfront],
                [AuthType.Authenticated, AuthType.Any]
            ];

            inputs.forEach(types => {
                it(`[${types}]`, () => {
                    const testFunction = Authorized(...types);
                    testFunction(request, response, next);
                    expect(response.locals.authChecked).to.be.true;
                });
            })
        });

        describe('should call next for any Authorization when types includes any', () => {
            const requiredTypeGroups = [
                [AuthType.Any],
                [AuthType.Authenticated, AuthType.Any],
                [AuthType.Any, AuthType.Authenticated],
                [AuthType.Any, AuthType.Cloudfront],
                [AuthType.Anonymous, AuthType.Any],
                [AuthType.Anonymous, AuthType.Any, AuthType.Cloudfront, AuthType.Authenticated]
            ];
            
            requiredTypeGroups.forEach(requiredTypes => {
                const testFunction = Authorized(...requiredTypes);
                authTypes.forEach(type => {
                    it(`${type} -> ${requiredTypes}`, () => {
                        testFunction(request, response, next);
                        expect(next.calledOnce).to.be.true;
                    });
                });
            });
        });

        describe ('should call next when types includes set authType', () => {
            const requiredTypeGroups = [
                [AuthType.Anonymous],
                [AuthType.Authenticated],
                [AuthType.Cloudfront],
                [AuthType.Any, AuthType.Authenticated],
                [AuthType.Anonymous, AuthType.Authenticated],
                [AuthType.Cloudfront, AuthType.Any, AuthType.Anonymous, AuthType.Authenticated],
                [AuthType.Cloudfront, AuthType.Cloudfront],
                [AuthType.Authenticated, AuthType.Any]
            ];

            requiredTypeGroups.forEach(required => {
                const testFunction = Authorized(...required);
                describe(`Required Authorization: ${required}`, () => {
                    required.forEach(type => {
                        if (type === AuthType.Any) return;
                        it(`Authorization: ${type}`, () => {
                            response.locals.authType = type;
                            testFunction(request, response, next);
                            expect(next.calledOnce).to.be.true;
                        });
                    });
                });
            });
        });

        describe('should error when authType, does not include Any, and is defined but not included in types', async () => {
            const requiredTypeGroups = [
                [AuthType.Anonymous],
                [AuthType.Authenticated],
                [AuthType.Cloudfront],
                [AuthType.Anonymous, AuthType.Authenticated],
                [AuthType.Cloudfront, AuthType.Authenticated],
                [AuthType.Cloudfront, AuthType.Cloudfront],
            ];

            const getExcludedAuths = (types: AuthType[]) => [AuthType.Anonymous, AuthType.Cloudfront, AuthType.Authenticated].filter(t => !types.includes(t));
            requiredTypeGroups.forEach(required => {
                const testFunction = Authorized(...required);
                describe(`Required Authorization: ${required}`, () => {
                    getExcludedAuths(required).forEach(type => {
                        if (type === AuthType.Any) return;
                        it(`Bad Authorization Type: ${type}`, () => {
                            response.locals.authType = type;
                            testFunction(request, response, next);
                            expect(next.calledOnce).to.be.true;
                            expect(next.getCalls()[0].args[0]).to.be.instanceOf(HttpError, 'next should be called with an Error type');
                        });
                    });
                });
            });
        });

        describe('should throw error with status 401 when access is denied and authType is Anonymous', () => {
            const requiredTypeGroups = [
                [AuthType.Authenticated],
                [AuthType.Cloudfront],
                [AuthType.Authenticated, AuthType.Cloudfront]
            ];

            requiredTypeGroups.forEach(required => {
                const testFunction = Authorized(...required);
                it(`Required: ${required}`, () => {
                    response.locals.authType = AuthType.Anonymous;
                    testFunction(request, response, next);
                    expect(next.calledOnce).to.be.true;
                    expect(next.getCalls()[0].firstArg)
                        .to.be.instanceOf(HttpError, 'next should be called with an Error type')
                        .and.to.haveOwnProperty('message').equals('Unauthorized', 'Message should be equivalent to that of a 401 error');
                });
            });
        });

        it('should throw error with status 401 when access is denied and authType is not Anonymous', () => {
            response.locals.authType = AuthType.Authenticated;
            const testFunction = Authorized(AuthType.Cloudfront);
            testFunction(request, response, next);
            expect(next.calledOnce).to.be.true;
            expect(next.firstCall.firstArg)
                .to.be.instanceOf(HttpError, 'next should be called with an Error type')
                .and.to.haveOwnProperty('message').equals('Forbidden', 'Message should be equivalent to that of a 403 error');
        });
    });
});
