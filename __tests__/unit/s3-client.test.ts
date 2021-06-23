import { expect } from 'chai';
import sinon from 'sinon';
import rewire from 'rewire';
import * as s3Service from '../../src/s3-client';
import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';


describe('s3-client', () => {
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

    })
})