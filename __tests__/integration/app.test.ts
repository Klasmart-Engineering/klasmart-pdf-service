import request from 'supertest';
import express from 'express';
import { appRouter } from '../../src/routers/app.router';
import { errorHandler } from '../../src/util/error-handler';
import sinon from 'sinon';
import * as pdfService from '../../src/pdf-service';
import createError from 'http-errors';
import { assert } from 'chai';
import { Readable } from 'stream';

const app = express();

app.use('/pdf', appRouter);
app.use(errorHandler);

const sandbox = sinon.createSandbox();
const serviceStub = sandbox.stub(pdfService);

describe('app.router', () => {
    let oldCmsEndpoint = process.env.CMS_BASE_URL;
    beforeEach(() => {
        process.env.CMS_BASE_URL = 'https://test-cms-endpoint.com';
    });
    
    afterEach(() => {
        if (oldCmsEndpoint) process.env.CMS_BASE_URL = oldCmsEndpoint;
        else delete process.env.CMS_BASE_URL;
        sandbox.reset();
    });

    describe('GET /:prefix/:pdfName/view.html', () => {
        
        it('should render an HTML document when getPDFPages resolves', async () => {
            serviceStub.getPDFPages.onFirstCall().resolves(3);
            await request(app)
                .get('/pdf/some.pdf/view.html')
                .expect(200)
                .expect('Content-Type', /text\/html/)
                .then(data => data.body.toString().startsWith('<!DOCTYPE html>'));
        });

        it('should respond with 500 when getPDFPages throws with a non-HTTP error', async () => {
            serviceStub.getPDFPages.rejects(new Error('test-error'));

            await request(app)
                .get('/pdf/a.pdf/view.html')
                .expect(500);
        });

        describe('should respond with the provided error status code when getPDFPages throws an HTTP error', async () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPages.onFirstCall().rejects(error);
                    await request(app)
                        .get('/pdf/misc.pdf/view.html')
                        .expect(e);
                });
            })
        });

        describe('should render a number of pages equal to the number returned by getPages', () => {
            
            const pageCount = [1, 13, 7, 2, 44, 100];
            pageCount.map(p => {
                it(''+p, async () => {
                    serviceStub.getPDFPages.onFirstCall().resolves(p);
                
                    await request(app)
                        .get(`/pdf/some-${p}.pdf/view.html`)
                        .expect(200)
                        .then(response => assert((response.text.match(/<img/g) || []).length === p, `${response.body.toString()} should contain ${p} img tags`));
                });
            });

        })
    });

    describe('GET /:prefix/:pdfName/pages', () => {
        it('should respond with 400 if pdfURL is not provided', async () => {
            await request(app)
                .get(`/pdf/some-file.pdf/pages`)
                .expect(400);
        });

        it('should respond with 200 and json payload that includes pages', async () => {
            serviceStub.getPDFPages.resolves(3);
            await request(app)
                .get(`/pdf/correct-file.pdf/pages?pdfURL=http://aboslute.com/somepdf.pdf`)
                .expect(200)
                .expect('Content-Type', /application\/json/)
                .then(response => { assert(!!response.body.pages);}  );
        });

        it('should respond with 500 if getPDFPages rejects with a non-http error', async () => {
            serviceStub.getPDFPages.rejects(new Error('misc-test-error'));
            await request(app)
                .get(`/pdf/correct-file.pdf/pages?pdfURL=http://aboslute.com/somepdf.pdf`)
                .expect(500);
        })

        describe('should respond with a corresponding error code when getPDFPages rejects with an http error', () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPages.rejects(error);
                    await request(app)
                        .get(`/pdf/correct-file.pdf/pages?pdfURL=http://aboslute.com/somepdf.pdf`)
                        .expect(e);
                });
            });
        });
    });

    describe('GET /:prefix/:pdfName/page/:page', () => {
        it('Should respond with 400 if page is a non-numeric string value', async () => {
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));
            await request(app)
                .get('/pdf/some.pdf/page/one')
                .expect(400);
        });

        it('Should respond with 400 if page is a floating point value', async () => {
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));
            await request(app)
                .get('/pdf/some.pdf/page/7.2')
                .expect(400);
        });

        describe('Should respond with 400 if page is a non-positive integer value', () => {
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('img data')));

            const nums = [0, -1, -22, -0]
            nums.forEach(n => {
                it(''+n, async () => {
                    await request(app)
                        .get(`/pdf/some.pdf/page/${n}`)
                        .expect(400);
                })
            })
            
        });

        it('Should respond with 200, content-type image/jpeg, and file data on success', async () => {
            const data = 'img data';
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from(data)));
            await request(app)
                .get('/pdf/some.pdf/page/1')
                .expect(200)
                .expect('Content-Type', /image\/jpeg/)
                .then(response => {
                    assert(
                        response.body.toString() === data,
                        'Should contain streamable data equivalent to that provided by getPDFPage'
                    )
                });
        });

        it('should respond with 500 if getPDFPage rejects with a non-http error', async () => {
            serviceStub.getPDFPage.rejects(new Error('misc-test-error'));
            await request(app)
                .get('/pdf/some.pdf/page/1')
                .expect(500);
        })

        describe('should respond with a corresponding error code when getPDFPage rejects with an http error', () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPage.rejects(error);
                    await request(app)
                        .get('/pdf/some.pdf/page/1')
                        .expect(e);
                });
            });
        });    
    });

    describe('GET /:pdfName/pages/:page', () => {
        serviceStub.getPDFPage.resolves(Readable.from(Buffer.from('some data')));

        it('should respond with 400 when no pdfURL query parameter is provided', async () => {
            serviceStub.getPDFPage.rejects(new Error('misc-test-error'));
            await request(app)
                .get('/pdf/some.pdf/pages/1')
                .expect(400);
        });

        it('should respond with 400 when pdfURL value cannot be parsed to a URL', async () => {
            serviceStub.getPDFPage.rejects(new Error('misc-test-error'));
            await request(app)
                .get('/pdf/some.pdf/pages/1?pdfURL=./not-a-url')
                .expect(400);
        });

        it('Should respond with 200, content-type image/jpeg, and file data on success', async () => {
            const data = 'img data';
            serviceStub.getPDFPage.resolves(Readable.from(Buffer.from(data)));
            await request(app)
                .get('/pdf/some.pdf/pages/1/?pdfURL=https://some-site.com/file.pdf')
                .expect(200)
                .expect('Content-Type', /image\/jpeg/)
                .then(response => {
                    assert(
                        response.body.toString() === data,
                        'Should contain streamable data equivalent to that provided by getPDFPage'
                    )
                });
        });

        it('should respond with 500 if getPDFPage rejects with a non-http error', async () => {
            serviceStub.getPDFPage.rejects(new Error('misc-test-error'));
            await request(app)
                .get('/pdf/some.pdf/pages/1?pdfURL=https://some-site.com/file.pdf')
                .expect(500);
        })

        describe('should respond with a corresponding error code when getPDFPage rejects with an http error', () => {
            const errors = [400, 401, 403, 404, 416, 500, 501, 502];
            errors.forEach(e => {
                it(''+e, async () => {
                    const error = createError(e, `http-error-${e}`);
                    serviceStub.getPDFPage.rejects(error);
                    await request(app)
                        .get('/pdf/some.pdf/pages/1?pdfURL=https://some-site.com/file.pdf')
                        .expect(e);
                });
            });
        });   
    });
})