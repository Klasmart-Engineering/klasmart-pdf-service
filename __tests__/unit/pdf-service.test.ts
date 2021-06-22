import * as pdfService from '../../src/pdf-service';
import * as typeorm from 'typeorm';
import * as s3Service from '../../src/s3-client';
import { MockManager } from '../util/MockManager';
import sinon from 'sinon';
import { S3Client } from '@aws-sdk/client-s3';
import * as imageConverter from '../../src/image-converter';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import NodeCache from 'node-cache';
import { Readable } from 'stream';
import { expect } from 'chai';
import fs from 'fs';
import { Stream } from 'winston/lib/winston/transports';

const sandbox = sinon.createSandbox();

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
    const s3SendStub = sandbox.stub(mockS3Client, 'send');

    let cache: NodeCache;


    beforeEach(() => {
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

    describe('getPDFPages', () => {
        it('it should reject with 500 if findOne rejects', async () => {
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
        
    });

    describe('getPDFPage', () => {
        it('should resolve to the readable when returned by readObject', async () => {
            const expectedData = ['expected', 'data'].join(' ').repeat(100);
            const data = Readable.from((Buffer.from(expectedData)));
            fakeS3Service.readObject.resolves(data)

            await pdfService.getPDFPage(testPdfName, 1, testUrl)
                .should.eventually.equal(data);
        });

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

        it('should resolve to third call of readObject if the first two are undefined', async () => {
            const expected = Readable.from(Buffer.from('abc'.repeat(100)));
            fakeEntityManager.findOne.resolves({totalPages: 7})
            fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
            fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('')))
            fakeS3Service.readObject.onFirstCall().resolves(undefined);
            fakeS3Service.readObject.onSecondCall().resolves(undefined)
            fakeS3Service.readObject.onThirdCall().resolves(expected);
            cache.set(pdfService.mapPageKey(testUrl, testPdfName, 1), Promise.resolve());

            await pdfService.getPDFPage(testPdfName, 1, testUrl)
                .should.eventually.equal(expected);

            expect(fakeS3Service.readObject.getCalls().length).to.equal(3);
        });

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

        // it('Should reject with 500 when write stream emits error while writing temporary file', async () => {
        //     const expected = Readable.from(Buffer.from('abc'.repeat(100)));
        //     const page = 10;
        //     fakeFs = sandbox.stub(fs);

        //     fakeEntityManager.findOne.resolves({totalPages: 12})
        //     fakeImageConverter.createDocumentFromStream.resolves({} as PDFDocumentProxy);
        //     fakeImageConverter.generatePageImage.resolves(Readable.from(Buffer.from('abc'.repeat(10000))));
        //     fakeS3Service.readObject.onFirstCall().resolves(undefined);
        //     fakeS3Service.readObject.onSecondCall().resolves(undefined)
        //     fakeS3Service.readObject.onThirdCall().resolves(expected);
        //     cache.set(pdfService.mapPageKey(testUrl, testPdfName, 10), Promise.resolve());
        //     const rs = new ReadableStream();
        //     rs.
            
        //     const stream = new fs.WriteStream();
        //     stream.cork();
        //     fakeFs.createWriteStream.returns(stream);
        //     fakeFs.createReadStream.returns(new fs.ReadStream)))
            
        //     try {
        //         // stream.emit('error', new Error('forced error'));
        //     } catch (err) {}
        //     await pdfService.getPDFPage(testPdfName, page, testUrl)
        //         .should.eventually.be.rejectedWith(`Document does not contain page: ${page}`)
        //         .and.be.an.instanceOf(Error)
        //         .and.have.property('status', 500);
        // });

    });
})