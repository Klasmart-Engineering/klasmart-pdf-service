import request from 'supertest';
import express from 'express';
import { appRouter } from '../../src/routers/app.router';
import { errorHandler } from '../../src/util/error-handler';
import sinon from 'sinon';
import * as pdfService from '../../src/pdf-service';

const app = express();

app.use('/pdf', appRouter);
app.use(errorHandler);

const sandbox = sinon.createSandbox();
const serviceStub = sandbox.stub(pdfService);

describe('app.router', () => {
    let oldCmsEndpoint = process.env.CMS_BASE_URL;
    beforeEach(() => {
        process.env.CMS_BASE_URL = 'https://test-cms-endpoint.com';
    })
    
    afterEach(() => {
        if (oldCmsEndpoint) process.env.CMS_BASE_URL = oldCmsEndpoint;
        else delete process.env.CMS_BASE_URL;
        sandbox.reset();
    })

    describe('GET /:prefix/:pdfName/view.html', () => {
        
        it('should render an HTML document when getPDFPages resolves', async () => {
            serviceStub.getPDFPages.onFirstCall().resolves(3);
            await request(app)
                .get('/pdf/some.pdf/view.html')
                .expect(200)
                .expect('Content-Type', /text\/html/)
                .then(data => data.body.toString().startsWith('<!DOCTYPE html>'));
        })

        describe('should render a number of pages equal to the number returned by getPages', () => {
            
            const pageCount = [1, 13, 7, 2, 44, 100];
            pageCount.map(p => {
                it(''+p, async () => {
                    serviceStub.getPDFPages.onFirstCall().resolves(p);
                
                    await request(app)
                        .get(`/pdf/some-${p}.pdf/view.html`)
                        .expect(200)
                        .expect(data => (data.body.toString().match(/<img/g) || []).length === p);
                });
            })

        })
    });

    describe('GET /:prefix/:pdfName/pages', () => {

    });

    describe('GET /:prefix/:pdfnName/page/:page', () => {

    });

    describe('GET /:pdfName/pages/:page', () => {
    
    });
})