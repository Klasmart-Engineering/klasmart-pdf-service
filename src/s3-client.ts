import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { JPEGStream } from 'canvas';
import { withLogger } from './logger';
import createError from 'http-errors';

// ? Note: This environment configuration should only be necessary for testing. For deployed applications, permissions should be automatically configured through the task role.
const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';

// ? Note: Region will be autoconfigurable in the ECS environment. You may need to supply this when connecting to S3 from a local machine.
const AWS_REGION = process.env.AWS_REGION ?? '';

const log = withLogger('s3-client');

const credentials = AWS_SECRET_KEY && AWS_SECRET_KEY_NAME
    ? {
        accessKeyId: AWS_SECRET_KEY_NAME,
        secretAccessKey: AWS_SECRET_KEY
    } : undefined;

let s3Client: S3Client;

export const initialize = async (providedS3Client?: S3Client): Promise<void> => {
    log.info('Initializing S3 Service');

    if (!credentials) {
        log.warn(`Using environment credentials rather than discoverable ECS credentials!`)
    }

    if (process.env.AWS_S3_HOST) {
        log.warn(`Using S3 hostname override: ${process.env.AWS_S3_HOST}.`)
    }

    if (!process.env.AWS_BUCKET) {
        log.error(`Fatal: No AWS Bucket defined! Provide a bucketname using the AWS_BUCKET environment variable.`)
        process.exit(1);
    }

    log.info(`S3 configured for storage in bucket: ${process.env.AWS_BUCKET}`)

    s3Client = providedS3Client || new S3Client({
        region: AWS_REGION || undefined,
        credentials, 
        endpoint: process.env.AWS_S3_HOST || undefined
    });

    log.info('S3 initialization complete');
}


export const putObject = async (key: string, stream: JPEGStream, contentLength: number): Promise<void> => {
    const request: PutObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        ContentType: 'image/jpeg',
        ContentLength: contentLength,
        Body: Readable.from(stream)
    }

    const command = new PutObjectCommand(request);

    log.debug(`Sending S3 object creation request: ${key}`);
    try {
        await s3Client.send(command);
    } catch (err){
        log.error(err.message);
        if (err.body) log.error(err.body);
        if (err.$metadata?.httpStatusCode) {
            throw createError(err.$metadata.httpStatusCode, err.message, err);
        }
        throw err;
    }
    log.debug('s3 upload complete');
    return Promise.resolve();
}

export const readObject = async (key: string): Promise<Readable | undefined> => {
    const request: GetObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key
    };

    const command = new GetObjectCommand(request);
    log.debug(`sending object request for: ${key}`);
    try {
        const response = await s3Client.send(command);
        return response.Body as Readable;
    } catch (error) {
        /* 
            ! NOTE: S3 will respond with a 403 for 404 content in a private bucket! 
            ! This condition is meant to catch scenarios when objects aren't in the bucket, not forbidden errors!
        */
        if (error.$metadata?.httpStatusCode === 403) {
            return undefined;
        }
        log.error(`S3 Read Object Failure: ${error.$metadata?.httpStatusCode} ${error.message}`);
        throw error;
    }
}
