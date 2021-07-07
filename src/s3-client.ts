import { GetObjectCommand, GetObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
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

    if (providedS3Client) {
        s3Client = providedS3Client;
        log.info('Using providedS3Client');
        return;
    }

    log.info('Initializing S3 Service');

    if (!credentials) {
        log.warn(`Using environment credentials rather than discoverable ECS credentials!`)
    }

    /* istanbul ignore if */
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
        endpoint: process.env.AWS_S3_HOST || undefined,
        apiVersion: '2006-03-01'
    });

    log.info('S3 initialization complete');
}

/**
 * Uploads data to S3 using lib-storage Upload utility function.
 * @param key - s3 object key
 * @param stream - data stream to be stored
 */
export const uploadObject = async (key: string, stream: JPEGStream): Promise<void> => {
    try {
        const s3Upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.AWS_BUCKET,
                Key: key,
                Body: stream
            }
        });

        console.log(s3Upload);

        s3Upload.on('httpUploadProgress', (progress) => {
            log.debug(JSON.stringify(progress));
        })

        await s3Upload.done();
    } catch (err) {
        console.log(err);
        log.error(`Object upload error: ${JSON.stringify(err)}`);
        throw createError(500, `Error uploading file to S3: ${JSON.stringify(err)}`)
    }
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
        if ([403, 404].includes(error.$metadata?.httpStatusCode)) {
            return undefined;
        }
        log.error(`S3 Read Object Failure: ${error.$metadata?.httpStatusCode} ${JSON.stringify(error)}`);
        throw error;
    }
}
