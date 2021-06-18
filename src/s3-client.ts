import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { JPEGStream } from 'canvas';
import { withLogger } from './logger';

const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';
const AWS_REGION = process.env.AWS_REGION ?? ''

const log = withLogger('s3-client');

const credentials = AWS_SECRET_KEY && AWS_SECRET_KEY_NAME
    ? {
        accessKeyId: AWS_SECRET_KEY_NAME,
        secretAccessKey: AWS_SECRET_KEY
    } : undefined;

const s3Client: S3Client = new S3Client({
    region: AWS_REGION,
    credentials,
    endpoint: process.env.AWS_S3_HOST || undefined
});

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
        throw err;
    }
    log.debug('s3 upload complete');
    return Promise.resolve();
}

export const readObject = async (key: string): Promise<Readable | undefined> => {
    log.debug(`retrieving S3 object: ${key}`);
    const request: GetObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key
    };

    const command = new GetObjectCommand(request);
    log.debug('sending object request');
    try {
        const response = await s3Client.send(command);
        return response.Body as Readable;
    } catch (error) {
        if (error.$metadata?.httpStatusCode === 404) {
            return undefined;
        }
        log.error(`S3 Read Object Failure: ${error.$metadata?.httpStatusCode} ${error.message}`);
        throw error;
    }
}
