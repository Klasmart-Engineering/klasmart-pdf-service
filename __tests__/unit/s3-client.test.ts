import chai, { expect } from 'chai';
import sinon from 'sinon';
import rewire from 'rewire';
import * as s3Service from '../../src/s3-client';
import { S3Client } from '@aws-sdk/client-s3';
import { PassThrough } from 'stream';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
chai.should();

describe('s3-client', () => {
    const rewiredLibStorage = rewire('@aws-sdk/lib-storage');

    const testKey = 'some-key/file.pdf';
    const sandbox = sinon.createSandbox();
    afterEach(() => {
        sandbox.reset();
    })

    describe('initialize', () => {
        let rewiredS3Client = rewire<typeof s3Service>('../../src/s3-client');

        it('should not have an S3Client instance if initialize is never called', () => {
            expect(rewiredS3Client.__get__('s3Client')).to.be.undefined;
        });

        it('should create an S3Client instance with default env configuration if one is not provided', async () => {
            await rewiredS3Client.initialize();
            const originalRegion = process.env.AWS_REGION;
            process.env.AWS_REGION = 'test-region';
            expect(rewiredS3Client.__get__('s3Client')).not.to.be.undefined;
            process.env.AWS_REGION = originalRegion;
        });

        it('should use provided S3Client instance if one is passed to initialize', async () => {
            const expectedInstance = sinon.createStubInstance(S3Client)
            await rewiredS3Client.initialize(expectedInstance as unknown as S3Client);
            expect(rewiredS3Client.__get__('s3Client')).to.equal(expectedInstance);
        });

        it('should encounter fatal error if no AWS bucket is supplied', async () => {
            const stub = sandbox.stub(process, 'exit');
            const oldBucket = process.env.AWS_BUCKET; 
            delete process.env.AWS_BUCKET;
            await rewiredS3Client.initialize();
            
            if (oldBucket) process.env.AWS_BUCKET = oldBucket;
            else delete process.env.AWS_BUCKET;

            sinon.assert.calledOnce(stub);
        });
    });

    describe('readObject', () => {
        const mockS3Client = new S3Client({});
        s3Service.initialize(mockS3Client);
        const s3ClientSendStub = sandbox.stub(mockS3Client, 'send');

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