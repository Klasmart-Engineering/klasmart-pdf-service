import { expect } from 'chai';
import sinon from 'sinon';
import rewire from 'rewire';
import * as s3Service from '../../src/s3-client';
import { S3Client } from '@aws-sdk/client-s3';
import { PassThrough } from 'stream';

describe('s3-client', () => {

    const testKey = 'some-key/file.pdf';

    describe('initialize', () => {
        let rewiredS3Client = rewire<typeof s3Service>('../../src/s3-client');

        it('should not have an S3Client instance if initialize is never called', () => {
            expect(rewiredS3Client.__get__('s3Client')).to.be.undefined;
        });

        it('should create an S3Client instance with default env configuration if one is not provided', () => {
            rewiredS3Client.initialize();
            const originalRegion = process.env.AWS_REGION;
            process.env.AWS_REGION = 'test-region';
            expect(rewiredS3Client.__get__('s3Client')).to.not.be.undefined;
            process.env.AWS_REGION = originalRegion;
        });

        it('should use provided S3Client instance if one is passed to initialize', () => {
            const expectedInstance = sinon.createStubInstance(S3Client)
            rewiredS3Client.initialize(expectedInstance as unknown as S3Client);
            expect(rewiredS3Client.__get__('s3Client')).to.equal(expectedInstance);

        });
    });

    describe('putObject', () => {
        let rewiredS3Client = rewire<typeof s3Service>('../../src/s3-client');
        const mockS3Client = new S3Client({});
        rewiredS3Client.initialize(mockS3Client);
        const s3ClientSendStub = sinon.stub(mockS3Client, 'send');

        it('should reject with bubbled error when send rejects', async () => {
            const inputStream = new PassThrough();
            const contentLength = 100;
            const expectedError = new Error('test-error');

            s3ClientSendStub.rejects(expectedError);

            await rewiredS3Client.putObject(testKey, inputStream, contentLength)
                .should.eventually.be.rejectedWith(expectedError);
        });

        it('should resolve cleanly when send resolves', async () => {
            const inputStream = new PassThrough();
            const contentLength = 100;

            s3ClientSendStub.resolves();

            await rewiredS3Client.putObject(testKey, inputStream, contentLength)
                .should.eventually.be.undefined;
        });
    });

    describe('readObject', () => {
        const mockS3Client = new S3Client({});
        s3Service.initialize(mockS3Client);
        const s3ClientSendStub = sinon.stub(mockS3Client, 'send');

        afterEach(() => {
            s3ClientSendStub.reset();
        })

        it('should reject bubbling error when send throws with a non-404 error', async () => {
            const expectedError = new Error('rejected-standard-testing-error');
            s3ClientSendStub.rejects(expectedError);

            await s3Service.readObject(testKey)
                .should.eventually.be.rejectedWith(expectedError);  
        });

        it('should resolve with undefined when send rejects with a 404 error', async () => {
            const error = new Error('rejected-standard-testing-error') as any;
            error.$metadata = {
                httpStatusCode: 404
            };
            
            s3ClientSendStub.rejects(error);

            await s3Service.readObject(testKey)
                .should.eventually.be.undefined;  
        });
        
        it('should resolve with a stream stored in body of response when send resolves', async () => {
            const expected = new PassThrough();
            s3ClientSendStub.resolves({ Body: expected });
            await s3Service.readObject(testKey)
                .should.eventually.equal(expected);
        });
    })
})