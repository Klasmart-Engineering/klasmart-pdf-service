import request from 'supertest';
import express from 'express';
import { appRouter as appV2Router } from '../../src/routers/app.router.v2';
import { errorHandler } from '../../src/util/error-handler';
import sinon from 'sinon';
import * as pdfService from '../../src/pdf-service';
import createError from 'http-errors';
import { assert } from 'chai';
import { Readable } from 'stream';
import { kidsloopAuthMiddleware } from 'kidsloop-token-validation';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import * as initTypeorm from '../../src/init-typeorm';

describe('app.router.v2', () => {
    let sandbox;
    let serviceStub;
    let app;
    let server;

    before(async () => {
    
        await initTypeorm.initialize();
        sandbox = sinon.createSandbox();
        serviceStub = sandbox.stub(pdfService);
        app = express();
    
        app.use(cookieParser());
        app.use(kidsloopAuthMiddleware());
        app.use(express.json());

        const staticFileLocation = process.env.EXECUTION_PWD + '/__tests__/integration/resources'
        app.use(express.static(staticFileLocation));
        app.use('/pdf/v2', appV2Router);
        app.use(errorHandler);
        server = app.listen(process.env.PORT)
    });
    
    beforeEach(() => {
    });

    afterEach(() => {
        sandbox.reset();
    });

    after(() => {
        sandbox.restore();
        sinon.restore();
        sandbox.reset();
        sinon.reset();
        server.close();
    });

    const pdfData = `%PDF-1.0
    1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj
    xref
    0 4
    0000000000 65535 f
    0000000010 00000 n
    0000000053 00000 n
    0000000102 00000 n
    trailer<</Size 4/Root 1 0 R>>
    startxref
    149
    %EOF`;

    const validJwt = jwt.sign({
        id: '01234567-1234-1234-1234-123456789012',
        email: 'pdf-test-email@test.com',
    }, process.env.DEV_JWT_SECRET, {
        algorithm: 'HS256',
        issuer: 'calmid-debug',
        expiresIn: '10m'
    });

    const expiringJwt = jwt.sign({
        id: '01234567-1234-1234-1234-123456789012',
        email: 'pdf-test-email@test.com',
    }, process.env.DEV_JWT_SECRET, {
        algorithm: 'HS256',
        issuer: 'calmid-debug',
        expiresIn: '0ms'
    });

    const cookies = {
        authorizingCookie: `access=${validJwt}`,
        invalidCookie: `access=kdsafslflksdhasfhsdkfjbkadfhekjdsbviuabkjbdfsfdsfdfakjhjkewuivbcjxba`,
        expiredJwt: `access=${expiringJwt}`
    };
    


    describe('POST /:prefix/v2/validate', () => {
        beforeEach(() => {
            serviceStub.validatePostedPDF.resolves({ valid: true });
        });

        it('should return a 401 when an access token is not included', async () => {
            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'application/pdf')
                .send(pdfData)
                .expect(401);
        });

        it('should return a 401 when an access token is included but expired', async () => {
            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'application/pdf')
                .set('Cookie', cookies.expiredJwt)
                .send(pdfData)
                .expect(401);
        });

        it('should return a 401 when an access token is included but expired', async () => {
            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'application/pdf')
                .set('Cookie', cookies.invalidCookie)
                .send(pdfData)
                .expect(401);
        });

        it('should respond with 200, application/json when valid cookie and content-type are supplied', async () => {
            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'application/pdf')
                .set('Cookie', cookies.authorizingCookie)
                .send(pdfData)
                .expect(200)
                .expect('content-type', /application\/json/);
        });

        it('should respond with 415 when a valid token is supplied but the content-type is not application/pdf', async () => {
            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'text/css')
                .set('Cookie', cookies.authorizingCookie)
                .send(pdfData)
                .expect(415);
        });

        it('should delegate propagated errors to the error handler', async () => {
            serviceStub.validatePostedPDF.rejects(createError(406));

            await request(app)
                .post('/pdf/v2/validate')
                .set('content-type', 'application/pdf')
                .set('Cookie', cookies.authorizingCookie)
                .send(pdfData)
                .expect(406);
        });
    });

    describe('GET /:prefix/v2/:path/:pdfName/prerender', () => {
        it('should resolve with 202 when accepted callback is invoked', async () => {
            serviceStub.prerenderDocument.callsFake(async (name: string, url: URL, accepted) => {
                accepted();
            });

            await request(app)
                .get('/pdf/v2/path/some.pdf/prerender')
                .expect(202);
        });

        it('should delegate to error handler', async () => {
            serviceStub.prerenderDocument.callsFake(async (name, url, accepted, reject) => reject(createError(406)))
            
            await request(app)
                .get('/pdf/v2/path/some.pdf/prerender')
                .expect(406);
        });

        describe('should allow access to multiple paths', async () => {
            const testPaths: [string, boolean][] = [
                ['/assets/valid.pdf', true],
                ['/test/a.pdf', true],
                ['/schedule_attachment/valid.pdf', true],
                ['/teacher_manual/valid.pdf', true],
                ['/thumbnail/valid.pdf', true],
                ['/empty/valid.pdf', false]
            ];

            testPaths.forEach(([path, expectation]) => {
                it(`${path} -> ${expectation ? 'Reachable' : 'Unreachable'}`, async () => {
                    serviceStub.prerenderDocument.callThrough();
                    await request(app)
                        .get(`/pdf/v2/${path}/prerender`)
                        .expect(expectation ? 202 : 404)
                });
            });
        });
    });

    describe('GET /:prefix/:pdfName/validate', () => {
        it('should respond with 200 and json body', async () => {
            serviceStub.validateCMSPDF.resolves({valid: true});
            await request(app)
                .get('/pdf/v2/path/some.pdf/validate')
                .expect(200)
                .expect('content-type', /application\/json/);
        });

        it('should delegate error handling to error middleware', async () => {
            serviceStub.validateCMSPDF.rejects(createError(413));
            await request(app)
                .get('/pdf/v2/path/some.pdf/validate')
                .expect(413);
        });

        describe('should validate on multiple CMS paths', async () => {
            const testPaths: [string, boolean][] = [
                ['/assets/valid.pdf', true],
                ['/test/a.pdf', true],
                ['/schedule_attachment/valid.pdf', true],
                ['/teacher_manual/valid.pdf', true],
                ['/thumbnail/valid.pdf', true],
                ['/empty/valid.pdf', false]
            ];

            testPaths.forEach(([path, expectation]) => {
                it(`${path} -> ${expectation ? 'Reachable' : 'Unreachable'}`, async () => {
                    serviceStub.validateCMSPDF.callThrough();
                    await request(app)
                        .get(`/pdf/v2/${path}/validate`)
                        .expect(expectation ? 200 : 404)
                });
            });
        });
    });

    describe('GET /:prefix/:pdfName/view.html', () => {
        it('should render an HTML document when getPDFPages resolves', async () => {
            serviceStub.getPDFPages.onFirstCall().resolves(3);
            await request(app)
                .get('/pdf/v2/path/some.pdf/view.html')
                .expect(200)
                .expect('Content-Type', /text\/html/)
                .then(data => data.body.toString().startsWith('<!DOCTYPE html>'));
        });

        it('should respond with 500 when getPDFPages throws with a non-HTTP error', async () => {
            serviceStub.getPDFPages.rejects(new Error('test-error'));

            await request(app)
                .get('/pdf/v2/path/a.pdf/view.html')
                .expect(500);
        });

        describe('should show pdf viewer on multiple CMS paths', async () => {
            const testPaths: [string, boolean][] = [
                ['/assets/valid.pdf', true],
                ['/test/a.pdf', true],
                ['/schedule_attachment/valid.pdf', true],
                ['/teacher_manual/valid.pdf', true],
                ['/thumbnail/valid.pdf', true],
                ['/empty/valid.pdf', false]
            ];

            testPaths.forEach(([path, expectation]) => {
                it(`${path} -> ${expectation ? 'Reachable' : 'Unreachable'}`, async () => {
                    serviceStub.getPDFPages.callThrough();
                    await request(app)
                        .get(`/pdf/v2/${path}/view.html`)
                        .expect(expectation ? 200 : 404)
                });
            });
        });

        describe('should respond with the provided error status code when getPDFPages throws an HTTP error', async () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPages.onFirstCall().rejects(error);
                    await request(app)
                        .get('/pdf/v2/path/misc.pdf/view.html')
                        .expect(e);
                });
            });
        });

        describe('should render a number of pages equal to the number returned by getPages', () => {
            
            const pageCount = [1, 13, 7, 2, 44, 100];
            pageCount.map(p => {
                it(''+p, async () => {
                    serviceStub.getPDFPages.onFirstCall().resolves(p);
                
                    await request(app)
                        .get(`/pdf/v2/path/some-${p}.pdf/view.html`)
                        .expect(200)
                        .then(response => assert((response.text.match(/<img/g) || []).length === p, `${response.body.toString()} should contain ${p} img tags`));
                });
            });
        });

        
    });

    describe('GET /:prefix/:pdfName/page/:page', () => {
        it('Should respond with 400 if page is a non-numeric string value', async () => {
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));
            await request(app)
                .get('/pdf/v2/path/some.pdf/page/one')
                .expect(400);
        });

        it('Should respond with 400 if page is a floating point value', async () => {
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));
            await request(app)
                .get('/pdf/v2/path/some.pdf/page/7.2')
                .expect(400);
        });

        describe('should show pdf viewer on multiple CMS paths', async () => {
            const testPaths: [string, boolean][] = [
                ['/assets/valid.pdf', true],
                ['/test/a.pdf', true],
                ['/schedule_attachment/valid.pdf', true],
                ['/teacher_manual/valid.pdf', true],
                ['/thumbnail/valid.pdf', true],
                ['/empty/valid.pdf', false]
            ];

            testPaths.forEach(([path, expectation]) => {
                it(`${path} -> ${expectation ? 'Reachable' : 'Unreachable'}`, async () => {
                    serviceStub.getPDFPages.callThrough();
                    await request(app)
                        .get(`/pdf/v2/${path}/view.html`)
                        .expect(expectation ? 200 : 404)
                });
            });
        });

        describe('Should respond with 400 if page is a non-positive integer value', () => {
            beforeEach(() => {
                serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));
            });
            
            const nums = [0, -1, -22, -0]
            nums.forEach(n => {
                it(''+n, async () => {
                    await request(app)
                        .get(`/pdf/v2/path/some.pdf/page/${n}`)
                        .expect(400);
                })
            })
            
        });

        it('Should respond with 200, content-type image/jpeg, and file data on success', async () => {
            const data = 'img data';
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from(data)));
            await request(app)
                .get('/pdf/v2/path/some.pdf/page/1')
                .expect(200)
                .expect('Content-Type', /image\/jpeg/)
                .then(response => {
                    assert(
                        response.body.toString() === data,
                        'Should contain streamable data equivalent to that provided by getPDFPage'
                    );
                });
        });

        it('should respond with 500 if getPDFPage rejects with a non-http error', async () => {
            serviceStub.getPDFPage.rejects(new Error('misc-test-error'));
            await request(app)
                .get('/pdf/v2/path/some.pdf/page/1')
                .expect(500);
        })

        describe('should respond with a corresponding error code when getPDFPage rejects with an http error', () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPage.rejects(error);
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/page/1')
                        .expect(e);
                });
            });
        });    
    });

    describe('dev endpoints:', () => {
        const withEnv = (async (env: string, f: Function) => {
            let originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = env;
            await f();
            process.env.NODE_ENV = originalEnv;
        })

        describe(':prefix/v2/:path/:pdfName/render-page/:page', () => {
            it('should return 404 when not in development mode', async () => {
                await withEnv('not-dev', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/1')
                        .expect(404);
                });
            });

            it('should respond with 400 in dev mode with a non-numeric page number', async () => {
                await withEnv('development', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/a')
                        .expect(400);
                });
            });

            it('should respond with 400 in dev mode with a non-whole page number', async () => {
                await withEnv('development', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/1.23')
                        .expect(400);
                });
            });

            it('should respond with 400 in dev mode with a non-positive page number', async () => {
                await withEnv('development', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/0')
                        .expect(400);
                });
            });

            it('should return an image when in dev mode and page a valid positive whole number', async () => {
                serviceStub.getDirectPageRender.resolves(Readable.from(Buffer.from(`datadatadata`)));
                await withEnv('development', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/10')
                        .expect(200)
                        .expect('content-type', /image\/jpeg/);
                });
            });

            it('should delegate to error handler', async () => {
                serviceStub.getDirectPageRender.rejects(createError(415));
                await withEnv('development', async () => {
                    await request(app)
                        .get('/pdf/v2/path/some.pdf/render-page/100')
                        .expect(415);
                });
            });

            describe('should render page on CMS paths', async () => {
                const testPaths: [string, boolean][] = [
                    ['/assets/valid.pdf', true],
                    ['/test/a.pdf', true],
                    ['/schedule_attachment/valid.pdf', true],
                    ['/teacher_manual/valid.pdf', true],
                    ['/thumbnail/valid.pdf', true],
                    ['/empty/valid.pdf', false]
                ];
    
                testPaths.forEach(([path, expectation]) => {
                    it(`${path} -> ${expectation ? 'Reachable' : 'Unreachable'}`, async () => {
                        await withEnv('development', async () => {
                            serviceStub.getDirectPageRender.callThrough();
                            await request(app)
                                .get(`/pdf/v2/${path}/render-page/1`)
                                .expect(expectation ? 200 : 404);
                        });
                    });
                });
            });
        });
    });
});
