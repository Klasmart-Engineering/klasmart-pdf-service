import * as pdfService from '../../src/pdf-service';
import * as typeorm from 'typeorm';
import * as s3Service from '../../src/s3-client';
import { MockManager } from '../util/MockManager';
import sinon from 'sinon';
import * as imageConverter from '../../src/image-converter';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import NodeCache from 'node-cache';
import { Readable } from 'stream';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs, { ReadStream, WriteStream } from 'fs';
import { PassThrough } from 'stream';
import { JPEGStream } from 'canvas';
import rewire from 'rewire';
import createError from 'http-errors';
import asyncTimeout from '../util/async-timeout';
import { Request } from 'express';
import { ValidationStatus } from '../../src/interfaces/validation-status';
import { v4 } from 'uuid';
import * as pdfOutlineBuilder from '../../src/pdf/pdf-outline-builder';

chai.use(chaiAsPromised);
chai.should();

const sandbox = sinon.createSandbox();
let rewiredPdfService = rewire<typeof pdfService>('../../src/pdf-service');
const textDecoder = new TextDecoder();

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
    let fakePdfOutlineBuilder: sinon.SinonStubbedInstance<typeof pdfOutlineBuilder>;

    const transactionMockImpl = async (fn: (args: any[]) => Promise<any>) => await fn(fakeEntityManager as any);
    const rejectStub = sandbox.stub();

    let cache: NodeCache;

    let previousCMSBaseURL: string;

    before(() => {
        previousCMSBaseURL = process.env.CMS_BASE_URL;
        process.env.CMS_BASE_URL = 'http://localhost:32891';
    })

    after(() => {
        process.env.CMS_BASE_URL = previousCMSBaseURL;
    })

    beforeEach(() => {
        rewiredPdfService = rewire<typeof pdfService>('../../src/pdf-service');
        fakeEntityManager = sandbox.createStubInstance(typeorm.EntityManager);
        fakeEntityManager.transaction.callsFake(transactionMockImpl as any);
        fakeImageConverter = sandbox.stub(imageConverter);
        fakeS3Service = sandbox.stub(s3Service);
        fakePdfOutlineBuilder = sandbox.stub(pdfOutlineBuilder);
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
        const getPageLabels: () => Promise<string[] | null> = () => Promise.resolve([]);
        beforeEach(() => {
            fakePdfOutlineBuilder.getAdaptedOutline.resolves([]);
        });
        it('should reject with 500 if findOne rejects', async () => {
            fakeEntityManager.findOne.rejects();

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it('should return totalPages if findOne returns a truthy value', async () => {
            const totalPages = 19;
            
            fakeEntityManager.findOne.resolves({ totalPages });

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
                .should.eventually.equal(totalPages);
        });

        it('should call initializeMetadata if findOne returns a falsy value and return pages from this', async () => {
            const numPages = 10;

            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            fakeImageConverter.createDocumentFromUrl.resolves({ numPages, getPageLabels } as PDFDocumentProxy);

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
                .should.eventually.equal(numPages);
        });

        it ('should reject with 500 if entity save rejects', async () => {
            const numPages = 1;

            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.rejects();
            fakeImageConverter.createDocumentFromUrl.resolves({ numPages, getPageLabels } as PDFDocumentProxy);

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it ('should reject with 500 if createDocumentFromUrl rejects', async () => {
            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            fakeImageConverter.createDocumentFromUrl.rejects();

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
                .should.eventually.be.rejectedWith('Error')
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 500);
        });

        it ('should reject with status code of propagated error from createDocumentFromUrl try-block when the error is an HttpError', async () => {
            fakeEntityManager.findOne.resolves(undefined);
            fakeEntityManager.save.resolvesArg(0);
            const expectedError = createError(401, 'sample-test-error')
            fakeImageConverter.createDocumentFromUrl.rejects(expectedError);

            await pdfService.getPDFPages('assets', 'pdf-name.pdf')
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

            await rewiredPdfService.getPDFPage(testPdfName, 1, 'assets')
                .should.eventually.be.rejected
                .and.have.property('status', 411);

        });

        describe('should reject with rethrown http error from readObject when http status error is not 403, 404', async () => {
            const errorCodes = [400, 401, 402, 405, 406, 500, 501, 502, 503, 504];
            errorCodes.forEach(code => {
                it(code.toString(), async () => {
                    const expected = createError(code);
                    fakeS3Service.readObject.rejects(expected);
                    
                    await pdfService.getPDFPage(testPdfName, 1, 'assets')
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
        
                    await pdfService.getPDFPage(testPdfName, 1, 'assets')
                        .should.eventually.equal(expected);
                });
            });
        })

        it('should resolve to second call of readObject if the first is undefined and a promise is in the cache', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const unexpected = Readable.from(Buffer.from('nono'.repeat(100)));
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(expected);
            fakeS3Service.readObject.onThirdCall().resolves(unexpected);


            fakeEntityManager.findOne.resolves({totalPages: 5});
            cache.set(pdfService.mapPageKey(new URL('http://localhost:32891/assets/some-pdf.pdf'), testPdfName, 1), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, 1, 'assets')
                .should.eventually.equal(expected);

            expect(fakeS3Service.readObject.getCalls().length).to.equal(2);
        });

        it('should reject with 404 when page request is greater than totalPages', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves({totalPages: 1})
            fakeImageConverter.createDocumentFromUrl.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, 'assets')
                .should.eventually.be.rejectedWith(`does not contain page: ${page}`)
                .and.be.an.instanceOf(Error)
                .and.have.property('status', 404);
        });

        it('should reject with 400 if requested pdf does not have processed metadata', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves(undefined);
            fakeImageConverter.createDocumentFromUrl.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, 'assets')
                .should.eventually.be.rejected
                .and.have.property('status', 400);
        });

        it('should reject with 400 when page request is greater than totalPages', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            const page = 10;
            fakeEntityManager.findOne.resolves({totalPages: 1})
            fakeImageConverter.createDocumentFromUrl.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, page, 'assets')
                .should.eventually.be.rejectedWith(`does not contain page: ${page}`)
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
            fakeImageConverter.createDocumentFromUrl.resolves({} as PDFDocumentProxy);
            
            // Force all shortcuts to fail, forcing the service to render the page
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.simpleWriteObject.onFirstCall().resolves();
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());
            
            // Fake the image data produced by pdf.js
            fakeImageConverter.generatePageImage.resolves(mockReadable as JPEGStream);
            
            
            // Fake the FS write stream
            fakeFs.createWriteStream.returns(mockWritable as unknown as WriteStream);
            
            const resultPromise = pdfService.getPDFPage(testPdfName, page, 'assets');
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
            fakeImageConverter.createDocumentFromUrl.resolves({} as PDFDocumentProxy);
            
            // Force all shortcuts to fail, forcing the service to render the page
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.simpleWriteObject.onFirstCall().resolves();
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());
            
            // Fake the image data produced by pdf.js
            fakeImageConverter.generatePageImage.resolves(mockReadable as JPEGStream);
            
            // Fake the FS write stream
            fakeFs.createWriteStream.returns(mockWritable as unknown as WriteStream);
            
            const resultPromise = pdfService.getPDFPage(testPdfName, page, 'assets');
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
            fakeImageConverter.createDocumentFromUrl.rejects(expectedError);

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
            fakeImageConverter.createDocumentFromUrl.rejects(expectedError);

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

            fakeImageConverter.createDocumentFromUrl.resolves(undefined);
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

            fakeImageConverter.createDocumentFromUrl.resolves(undefined);
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
            fakeS3Service.simpleWriteObject.rejects(createError(411));


            fakeImageConverter.createDocumentFromUrl.resolves(undefined);
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
            fakeS3Service.simpleWriteObject.rejects(new Error('non-http error'));


            fakeImageConverter.createDocumentFromUrl.resolves(undefined);
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
            fakeS3Service.simpleWriteObject.resolves();

            fakeImageConverter.createDocumentFromUrl.resolves(undefined);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('data')));

            rewiredPdfService.__set__('writeStreamToTempFile', sandbox.stub().resolves());

            await rewiredPdfService.__get__('renderSinglePage')('key', new URL('https://pdf-service.com/pdf.pdf'), page)
                .should.eventually.not.be.undefined;
        });
    
    });

    describe('getDirectPageRender', () => {
    
    });

    describe('prerenderDocument', () => {
        const pdfName = 'test-file.pdf';
        it('should attempt to generate a page from 1 to return value of getPDFPages inclusively', async () => {
            let count = 0;
            
            rewiredPdfService.__set__('getPDFPages', async () => Promise.resolve(5));
            rewiredPdfService.__set__('getPDFPage', async () => {
                count++;
                return Promise.resolve(Readable.from(Buffer.from('')));
            });

            await rewiredPdfService.prerenderDocument('somepdf', pdfName, () => {}, rejectStub);
            await asyncTimeout(300);
            expect(count).to.equal(5);
        });
        it('should propragate error by calling reject callback', async () => {
            let count = 0;
            const expected = new Error('prerender-test-error');

            rewiredPdfService.__set__('getPDFPages', async () => Promise.reject(expected));
            rewiredPdfService.__set__('getPDFPage', async () => {
                count++;
                return Promise.resolve(Readable.from(Buffer.from('')));
            });

            await rewiredPdfService.prerenderDocument('somepdf', pdfName, () => {}, rejectStub)
            expect(rejectStub.calledOnce).be.true;
            expect(rejectStub.firstCall.firstArg).to.equal(expected);
        });
        it('should continue rendering pages even if an error occurs in one page', async () => {
            let count = 0;

            rewiredPdfService.__set__('getPDFPages', async () => Promise.resolve(3));
            rewiredPdfService.__set__('getPDFPage', async () => {
                count++;
                if (count === 1) return Promise.reject('unexpected-error');
                return Promise.resolve(Readable.from(Buffer.from('')));
            });

            await rewiredPdfService.prerenderDocument('somepdf', pdfName, () => {}, rejectStub);
            await asyncTimeout(300);
            expect(count).to.equal(3);
        });
        it('should resolve promise even when pages remain to be processed', async () => {
            const acceptedStub = sandbox.stub();

            rewiredPdfService.__set__('getPDFPages', async () => Promise.resolve(1));
            rewiredPdfService.__set__('getPDFPage', async () => {
                await asyncTimeout(25);
                return Promise.resolve(Readable.from(Buffer.from('')));
            });

            rewiredPdfService.prerenderDocument('somepdf', pdfName, acceptedStub, rejectStub);
            // Although prerenderDocument has resolved, getPDFPage should not have resolved yet
            expect(acceptedStub.calledOnce).to.equal(false);
            
            // Wait another moment for getPDFPage to resolve
            await asyncTimeout(125);
            
            // Now count should be 1
            expect(acceptedStub.calledOnce).to.equal(true);
        });
    })

    describe('validatePostedPDF', async () => {
        // Utility to create a request object that has a streamable data payload
        const createRequest = (data: Uint8Array): Request => { 
            const readStream = Readable.from(data) as Request;
            readStream.headers = {
                'content-length': ''+data.byteLength
            }
            return readStream as Request;
        }

        let readFileStub: sinon.SinonStub;
        let writeStreamPt: PassThrough;

        beforeEach(() => {
            fakeFs = sandbox.stub(fs);
            readFileStub = sandbox.stub();
            sandbox.stub(fs, 'promises').value({ readFile: readFileStub });
            writeStreamPt = new PassThrough();
            fakeFs.createWriteStream.callsFake(() => {
                return writeStreamPt as unknown as WriteStream;
            });
            fakeFs.createReadStream.returns(ReadStream.from('readable data') as ReadStream);
        });

        afterEach(() => {
            sandbox.reset();
        });


        it('should attempt to write temporary file from request payload', async () => {
            readFileStub.returns(Buffer.from('filedata'));
            const callbackStub = sandbox.stub();
            const payload = 'Expected data payload';
            const request = createRequest(Buffer.from(payload));
            fakeImageConverter.validatePDFTextContent.resolves({
                valid: true,
                pages: 1
            });

            const result = rewiredPdfService.validatePostedPDF(request, callbackStub);
            let wroteData = '';
            writeStreamPt.on('data', (bytes) => wroteData = wroteData + bytes);
            await result;

            expect(wroteData).to.equal(payload);
        });

        it('it should call temp file register callback', async () => {
            readFileStub.returns(Buffer.from('filedata'));
            const callbackStub = sandbox.stub();
            const payload = 'Expected data payload';
            const request = createRequest(Buffer.from(payload));
            fakeImageConverter.validatePDFTextContent.resolves({
                valid: true,
                pages: 1
            });

            const result = rewiredPdfService.validatePostedPDF(request, callbackStub);
            let wroteData = '';
            writeStreamPt.on('data', (bytes) => wroteData = wroteData + bytes);
            await result;
            expect(callbackStub.calledOnce).to.be.true;
        });

        it('should read file data and pass to validatePDFTextContent in config object', async () => {
            const expectedReadData = 'data to be passed to imageConverter';
            readFileStub.resolves(Buffer.from(expectedReadData));

            const callbackStub = sandbox.stub();
            const payload = 'Expected data payload';
            const request = createRequest(Buffer.from(payload));
            fakeImageConverter.validatePDFTextContent.resolves({
                valid: true,
                pages: 1
            });

            const result = rewiredPdfService.validatePostedPDF(request, callbackStub);
            let wroteData = '';
            writeStreamPt.on('data', (bytes) => wroteData = wroteData + bytes);
            await result;

            expect(fakeImageConverter.validatePDFTextContent.calledOnce).to.be.true;
            /* This is sort of gross, but should give the most useful failure reporting
               Grabs the first parameter of the first call to validatePDFTextContent - this should be buffer returned by 
               readFileStub converted to a Uint8Array - the test case will decode this to its string value and compare it to the 
               original input
            */
            expect(textDecoder.decode(fakeImageConverter.validatePDFTextContent.getCalls()[0].args[0].data as Uint8Array))
                .to.equal(expectedReadData)
        });

        it('should reject when temp file write stream errors', async () => {
            const expectedReadData = 'data to be passed to imageConverter';
            readFileStub.resolves(Buffer.from(expectedReadData));

            const callbackStub = sandbox.stub();
            const payload = 'Expected data payload';
            const request = createRequest(Buffer.from(payload));
            fakeImageConverter.validatePDFTextContent.resolves({
                valid: true,
                pages: 1
            });

            const expectedError = new Error('test-error');

            const result = rewiredPdfService.validatePostedPDF(request, callbackStub);
            writeStreamPt.emit('error', expectedError);
            await result.should.eventually.be.rejectedWith(expectedError.message);
        });

        it('should reject when hash read stream errors', async () => {
            
            // Stubs / Setup
            const expectedReadData = 'data to be passed to imageConverter';
            readFileStub.resolves(Buffer.from(expectedReadData));

            const callbackStub = sandbox.stub();
            fakeImageConverter.validatePDFTextContent.resolves({
                valid: true,
                pages: 1
            });
            
            // Create a fake Request object with a readable data payload
            const payload = 'Expected data payload';
            const request = createRequest(Buffer.from(payload));
            
            // pipe first streams data so that the stream can complete, data is not needed for test so its forgotten 
            writeStreamPt.on('data', (bytes) => bytes);
            
            const readToHashStream = new PassThrough();
            fakeFs.createReadStream.callsFake(() => {
                return readToHashStream as unknown as ReadStream;
            });
            
            const result = rewiredPdfService.validatePostedPDF(request, callbackStub);
            
            // Provide some time for internal promises to resolve and reach the point where the stream to hash pipeline is hooked up
            await asyncTimeout(30);
            
            // Error that the stream should throw and should bubble up and cause a rejection of the testing function
            const expectedError = new Error('hashing-test-error');
            readToHashStream.emit('error', expectedError);

            await result.should.eventually.be.rejectedWith(expectedError);
        });
    });

    describe('validatePDFWithStatusCallback', async () => {
        const validatePDFWithStatusCallback = rewiredPdfService.__get__('validatePDFWithStatusCallback');
        it('should call callback with failure if loadDocument throws', async () => {
            const loadDocument = () => Promise.reject({});
            const callback = sinon.stub<[ValidationStatus]>();
            await validatePDFWithStatusCallback('key', loadDocument, callback);
            expect(callback.getCalls()[0].firstArg).not.to.be.undefined;
            expect(callback.getCalls()[0].firstArg.valid).to.be.false;
        });

        it('should call callback with pass if all calls to generatePageImage resolve', async () => {
            const loadDocument = () => Promise.resolve({ numPages: 5 });
            const callback = sinon.stub<[ValidationStatus]>();
            fakeImageConverter.generatePageImage.resolves();
            await validatePDFWithStatusCallback('key', loadDocument, callback);
            expect(callback.lastCall?.firstArg?.valid).to.be.true;
        });

        it('should call callback n+1 times for a document of n pages when all pages resolve', async () => {
            const numPages = 5;
            const loadDocument = () => Promise.resolve({ numPages });
            const callback = sinon.stub<[ValidationStatus]>();
            fakeImageConverter.generatePageImage.resolves();
            await validatePDFWithStatusCallback('key', loadDocument, callback);
            expect(callback.getCalls().length).to.equal(numPages + 1);
        });

        it('should call callback with failure when generatePageImage rejects', async () => {
            const loadDocument = () => Promise.resolve({ numPages: 5 });
            const callback = sinon.stub<[ValidationStatus]>();
            fakeImageConverter.generatePageImage.resolves();
            fakeImageConverter.generatePageImage.onThirdCall().rejects({});
            await validatePDFWithStatusCallback('key', loadDocument, callback);
            expect(callback.lastCall?.firstArg?.valid).to.be.false;
        });

        it('should call callback with pages in sequential order', async () => {
            const numPages = 5;
            let expectedPage = 0;
            const loadDocument = () => Promise.resolve({ numPages });
            const callback = sinon.stub<[ValidationStatus]>();
            fakeImageConverter.generatePageImage.resolves();
            await validatePDFWithStatusCallback('key', loadDocument, callback);
            const calls = callback.getCalls();
            for(let i = 0; i < calls.length; i++) {
                const arg: ValidationStatus = calls[i].firstArg;
                if (!arg.validationComplete) {
                    expect(arg.pagesValidated).to.equal(++expectedPage);
                }
            }
        });
    })
});