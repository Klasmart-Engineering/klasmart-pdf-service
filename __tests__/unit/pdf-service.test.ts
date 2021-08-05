import * as pdfService from '../../src/pdf-service';
import * as typeorm from 'typeorm';
import * as s3Service from '../../src/s3-client';
import { MockManager } from '../util/MockManager';
import sinon from 'sinon';
import { S3Client } from '@aws-sdk/client-s3';
import * as imageConverter from '../../src/image-converter';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import NodeCache from 'node-cache';
import { Readable } from 'stream';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs, { WriteStream } from 'fs';
import { PassThrough } from 'stream';
import { JPEGStream } from 'canvas';
import rewire from 'rewire';
import createError from 'http-errors';

chai.use(chaiAsPromised);
chai.should();

const sandbox = sinon.createSandbox();
let rewiredPdfService = rewire<typeof pdfService>('../../src/pdf-service');


describe('pdf-service', () => {
    // Helper parameter values
    const testUrl = new URL('http://fake-url.com');
    const testPdfName = 'some-pdf.pdf';

    // Sinon Fakes/Stubs/Sandbox Setup
    let fakeEntityManager: sinon.SinonStubbedInstance<typeorm.EntityManager>;
    let mockManager: MockManager;
    let fakeImageConverter: sinon.SinonStubbedInstance<typeof imageConverter>;
    let fakeS3Service: sinon.SinonStubbedInstance<typeof s3Service>;
    let fakeFs: sinon.SinonStubbedInstance<typeof fs>;

    const transactionMockImpl = async (fn: (args: any[]) => Promise<any>) => await fn(fakeEntityManager as any);

    const mockS3Client = new S3Client({});

    let cache: NodeCache;


    beforeEach(() => {
        rewiredPdfService = rewire<typeof pdfService>('../../src/pdf-service');
        fakeEntityManager = sandbox.createStubInstance(typeorm.EntityManager);
        fakeEntityManager.transaction.callsFake(transactionMockImpl as any);
        fakeImageConverter = sandbox.stub(imageConverter);
        fakeS3Service = sandbox.stub(s3Service);
        mockManager = new MockManager('getManager', fakeEntityManager);        
        cache = new NodeCache({stdTTL: 10000, checkperiod: 10000});
        pdfService.initialize(cache);
    });
    
    afterEach(() => {
        sandbox.restore();
        mockManager.close();
        cache.flushAll();
        cache.close();
    })

    describe('initialize', () => {
        it('should not have a cache if initialize was not called', () => {
            expect(rewiredPdfService.__get__('pageResolutionCache')).to.be.undefined;
        });

        it('should have a default nodecache when none is provided to initialize', () => {
            rewiredPdfService.initialize();
            expect(rewiredPdfService.__get__('pageResolutionCache')).not.to.be.undefined;
        });

        it('should have NodeCache provided when initialized was called', () => {
            const expectedCache = new NodeCache({});
            rewiredPdfService.initialize(expectedCache);
            expect(rewiredPdfService.__get__('pageResolutionCache')).to.equal(expectedCache);
        });
    });

    describe('getPDFPages', () => {
        it('should reject with 500 if findOne rejects', async () => {
            fakeEntityManager.findOne.rejects();

            await pdfService.getPDFPages(testUrl)
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it('should return totalPages if findOne returns a truthy value', async () => {
            const totalPages = 19;
            
            fakeEntityManager.findOne.resolves({ totalPages });

            await pdfService.getPDFPages(testUrl)
                .should.eventually.equal(totalPages);
        });

        it('should call initializeMetadata if findOne returns a falsy value and return pages from this', async () => {
            const numPages = 10;

            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            fakeImageConverter.createDocumentFromStream.resolves({ numPages } as PDFDocumentProxy);

            await pdfService.getPDFPages(testUrl)
                .should.eventually.equal(numPages);
        });

        it ('should reject with 500 if entity save rejects', async () => {
            const numPages = 1;

            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.rejects();
            fakeImageConverter.createDocumentFromStream.resolves({ numPages } as PDFDocumentProxy);

            await pdfService.getPDFPages(testUrl)
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it ('should reject with 500 if createDocumentFromStream rejects', async () => {
            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            fakeImageConverter.createDocumentFromStream.rejects();

            await pdfService.getPDFPages(testUrl)
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it ('should reject with status code of propagated error from createDocumentFromStream try-block when the error is an HttpError', async () => {
            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            const expectedError = createError(401, 'sample-test-error')
            fakeImageConverter.createDocumentFromStream.rejects(expectedError);

            await pdfService.getPDFPages(testUrl)
                .should.eventually.be.rejectedWith(expectedError.message)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', expectedError.status);
        });
        
    });

    describe('getPDFPage', () => {
        it('should not reject when first call to s3Service.readObject rejects with a non-HttpError', async () => {
            rewiredPdfService.initialize();
            fakeS3Service.readObject.onFirstCall().rejects(new Error('Non HTTP error'));
            rewiredPdfService.__set__('renderSinglePage', () => Promise.reject(createError(411)));

            await rewiredPdfService.getPDFPage(testPdfName, 1, testUrl)
                .should.eventually.be.rejected
                .and.have.property('status', 411);

        });

        describe('should reject with rethrown http error from readObject when http status error is not 403, 404', async () => {
            const errorCodes = [400, 401, 402, 405, 406, 500, 501, 502, 503, 504];
            errorCodes.forEach(code => {
                it(code.toString(), async () => {
                    const expected = createError(code);
                    fakeS3Service.readObject.rejects(expected);
                    
                    await pdfService.getPDFPage(testPdfName, 1, testUrl)
                        .should.eventually.be.rejected
                        .and.be.an.instanceOf(Error)
                        .and.have.property('status', code);
                })
            })
        });

        it('should not reject if first readObject call rejects with http status 404 or 403 and subsequent calls resolve', async () => {
            const errorCodes = [403, 404];
            errorCodes.forEach(code => {
                it(code.toString(), async () => {
                    const expected =  Readable.from(Buffer.from('data'));
                    const err = createError(code);
                    fakeS3Service.readObject.onFirstCall().rejects(err);
                    fakeS3Service.readObject.onSecondCall().resolves(expected)
                    cache.set(pdfService.mapPageKey(testUrl, testPdfName, 1), Promise.resolve());
        
                    await pdfService.getPDFPage(testPdfName, 1, testUrl)
                        .should.eventually.equal(expected);
                });
            });
        })

        it('should resolve to second call of readObject if the first is undefined and a promise is in the cache', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const unexpected = Readable.from(Buffer.from('nono'.repeat(100)));
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(expected)
            fakeS3Service.readObject.onThirdCall().resolves(unexpected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 1), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, 1, testUrl)
                .should.eventually.equal(expected);

            expect(fakeS3Service.readObject.getCalls().length).to.equal(2);
        });

        // it('should resolve to second call of readObject if the first is undefined and the key is unregistered in the cache and second call is truthy', async () => {
        //     const expected = Readable.from(Buffer.from('abc'.repeat(100)));
        //     const unexpected = Readable.from(Buffer.from('nono'.repeat(100)));
        //     fakeS3Service.readObject.onFirstCall().resolves(undefined);
        //     fakeS3Service.readObject.onSecondCall().resolves(expected)
        //     fakeS3Service.readObject.onThirdCall().resolves(unexpected);
        //     fakeEntityManager.findOne.resolves({totalPages: 7})
        //     fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            
            
        //     await pdfService.getPDFPage(testPdfName, 1, testUrl)
        //         .should.eventually.equal(expected);

        //     expect(fakeS3Service.readObject.getCalls().length).to.equal(2);
        // });

        // it('should resolve to third call of readObject if the first two are undefined', async () => {
        //     const expected = Readable.from(Buffer.from('abc'.repeat(100)));
        //     fakeEntityManager.findOne.resolves({totalPages: 7})
        //     fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
        //     fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
        //     fakeS3Service.readObject.onFirstCall().resolves(undefined);
        //     fakeS3Service.readObject.onSecondCall().resolves(undefined)
        //     fakeS3Service.readObject.onThirdCall().resolves(expected);
        //     cache.set(pdfService.mapPageKey(testUrl, testPdfName, 1), Promise.resolve());

        //     await pdfService.getPDFPage(testPdfName, 1, testUrl)
        //         .should.eventually.equal(expected);

        //     expect(fakeS3Service.readObject.getCalls().length).to.equal(3);
        // });

        // it('should reject with 500 when readObject returns undefined after renderSinglePage resolves', async () => {
        //     fakeEntityManager.findOne.resolves({totalPages: 7})
        //     fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
        //     fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
        //     fakeS3Service.readObject.onFirstCall().resolves(undefined);
        //     fakeS3Service.readObject.onSecondCall().resolves(undefined)
        //     fakeS3Service.readObject.onThirdCall().resolves(undefined);
        //     cache.set(pdfService.mapPageKey(testUrl, testPdfName, 1), Promise.resolve());

        //     await pdfService.getPDFPage(testPdfName, 1, testUrl)
        //         .should.eventually.be.rejectedWith('Unable to retrieve object after write')
        //         .and.be.an.instanceOf(Error)
        //         .and.have.property('status', 500);

        // });

        it('should reject with 404 when page request is greater than totalPages', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves({totalPages: 1})
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, testUrl)
                .should.eventually.be.rejectedWith(`Document does not contain page: ${page}`)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 404);
        });

        it('should reject with 400 if requested pdf does not have processed metadata', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves(undefined);
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, testUrl)
                .should.eventually.be.rejected
                .and.have.property('status', 400);
        });

        it('should reject with 400 when page request is greater than totalPages', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves({totalPages: 1})
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, testUrl)
                .should.eventually.be.rejectedWith(`Document does not contain page: ${page}`)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 404);
        });

        /**
         * Note on this test:
         * This test is meant to target a high complexity scenario that involves a significant amount of setup.
         * The particular configuration will force the service to exhaust all efforts to retrieve the image file
         * from storage causing it to generate the imge using pdf.js. Then the scenario forces a write stream error
         * to test how the application handles stream errors. 
         */
        it('Should reject with 500 when JPEGStream emits error while writing temporary file', async () => {
            const page = 10;
            fakeFs = sandbox.stub(fs);

            const mockReadable = new PassThrough() as unknown;
            const mockWritable = new PassThrough() as unknown;
            const expectedError = new Error('read-stream-test-error');

            // The PDF has been initialized
            fakeEntityManager.findOne.resolves({totalPages: 12})
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            
            // Force all shortcuts to fail, forcing the service to render the page
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.uploadObject.onFirstCall().resolves();
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());
            
            // Fake the image data produced by pdf.js
            fakeImageConverter.generatePageImage.resolves(mockReadable as JPEGStream);
            
            
            // Fake the FS write stream
            fakeFs.createWriteStream.returns(mockWritable as unknown as WriteStream);
            
            const resultPromise = pdfService.getPDFPage(testPdfName, page, testUrl);
            await new Promise<void>((resolve, _) => resolve());
            
            setTimeout(() => {
                // Force a stream error
                (mockReadable as PassThrough).emit('error', expectedError);
            }, 100)

            await resultPromise
                .should.eventually.be.rejectedWith(expectedError.message)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it('Should reject with 500 when write stream emits error while writing temporary file', async () => {
            const page = 10;
            fakeFs = sandbox.stub(fs);

            const mockReadable = new PassThrough();
            const mockWritable = new PassThrough();
            const expectedError = new Error('write-stream-test-error');

            // The PDF has been initialized
            fakeEntityManager.findOne.resolves({totalPages: 12})
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            
            // Force all shortcuts to fail, forcing the service to render the page
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.uploadObject.onFirstCall().resolves();
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());
            
            // Fake the image data produced by pdf.js
            fakeImageConverter.generatePageImage.resolves(mockReadable as JPEGStream);
            
            // Fake the FS write stream
            fakeFs.createWriteStream.returns(mockWritable as unknown as WriteStream);
            
            const resultPromise = pdfService.getPDFPage(testPdfName, page, testUrl);
            await new Promise<void>((resolve, _) => resolve());
            
            try {
                setTimeout(() => {
                    // Force a stream error
                    mockWritable.emit('error', expectedError);
                }, 100)
            } catch (error) {
                console.log(error);
            }

            await resultPromise
                .should.eventually.be.rejectedWith(expectedError.message)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });
    });

    describe('renderSinglePage', () => {
        let renderSinglePage;
        const fsPromisesstub = sandbox.stub(fs, 'promises');
        beforeEach(() => {
            rewiredPdfService.initialize();
            rewiredPdfService.__get__('renderSinglePage');
            renderSinglePage = rewiredPdfService.__get__('renderSinglePage');
        })
        
        it('should reject with 400 when findOne returns undefined', async () => {
            fakeEntityManager.findOne.resolves(undefined);

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'))
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 400);
        });

        it('should reject with 404 when requested page is greater than totalPages', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page - 1
            });

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 404);
        });

        it('should not reject with 404 when requested page is equal to totalPages', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page
            });

            // Throw an error after page validation to simplify test configuration
            const captureStatus = 502;
            const expectedError = createError(captureStatus);
            fakeImageConverter.createDocumentFromStream.rejects(expectedError);

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.not.have.property('status', 404);
        });

        it('should not reject with 404 when requested page is less than totalPages', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            // Throw an error after page validation to simplify test configuration
            const captureStatus = 502;
            const expectedError = createError(captureStatus);
            fakeImageConverter.createDocumentFromStream.rejects(expectedError);

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.not.have.property('status', 404);
        });

        it('should reject with 500 when writeStreamToTempFile rejects', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            fakeImageConverter.createDocumentFromStream.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().rejects(new Error('401')));

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it('should reject with 500 when fs.promises.stat rejects', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            const statStub = sandbox.stub().rejects(createError(412, 'testing error'));
            sandbox.stub(fs, 'promises').value({ stat: statStub });

            fakeImageConverter.createDocumentFromStream.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().resolves());

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it('should rethrow HttpError when s3Seervice.uploadObject rejects with instance of HttpError', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            const statStub = sandbox.stub().resolves({
                size: 10000
            });
            sandbox.stub(fs, 'promises').value({ stat: statStub });
            fakeFs = sandbox.stub(fs);
            fakeFs.createReadStream.onFirstCall().returns({
                pipe: sandbox.stub()
            } as any);
            fakeFs.createWriteStream.returns({} as any);
            fakeFs.createReadStream.onSecondCall().returns(undefined as any);
            fakeS3Service.uploadObject.rejects(createError(411));


            fakeImageConverter.createDocumentFromStream.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().resolves());

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.be.rejected
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 411);
        });
    
        it('should resolve when s3Seervice.uploadObject rejects with non-HttpError', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            const statStub = sandbox.stub().resolves({
                size: 10000
            });
            sandbox.stub(fs, 'promises').value({ stat: statStub });
            fakeFs = sandbox.stub(fs);
            fakeFs.createReadStream.onFirstCall().returns({
                pipe: sandbox.stub()
            } as any);
            fakeFs.createWriteStream.returns({} as any);
            fakeFs.createReadStream.onSecondCall().returns(undefined as any);
            fakeS3Service.uploadObject.rejects(new Error('non-http error'));


            fakeImageConverter.createDocumentFromStream.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().resolves());

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.not.be.undefined;
        });
    
        it('should resolve when s3Seervice.uploadObject resolves', async () => {
            const page = 10;
            fakeEntityManager.findOne.resolves({
                totalPages: page + 1
            });

            const statStub = sandbox.stub().resolves({
                size: 10000
            });
            sandbox.stub(fs, 'promises').value({ stat: statStub });
            fakeFs = sandbox.stub(fs);
            fakeFs.createReadStream.onFirstCall().returns({
                pipe: sandbox.stub()
            } as any);
            fakeFs.createWriteStream.returns({} as any);
            fakeFs.createReadStream.onSecondCall().returns(undefined as any);
            fakeS3Service.uploadObject.resolves();

            fakeImageConverter.createDocumentFromStream.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().resolves());

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.not.be.undefined;
        });
    
    });


});