import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { JPEGStream } from 'canvas';
import { withLogger } from './logger';
import { ECSCredentials } from 'aws-sdk';

const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';
const AWS_REGION = process.env.AWS_REGION ?? '';
const defaultRegion = 'ap-northeast-2';
const log = withLogger('s3-client');

const envCredentials = AWS_SECRET_KEY && AWS_SECRET_KEY_NAME
    ? {
        accessKeyId: AWS_SECRET_KEY_NAME,
        secretAccessKey: AWS_SECRET_KEY
    } : undefined;

let s3Client: S3Client;

let ecsCredentials: ECSCredentials | undefined;

export const checkEcsCredentialsRefresh = async (): Promise<void> => {
    // Resolve immediately in these two cases - no need to do anything asynchronous
    if (!ecsCredentials || !ecsCredentials.needsRefresh()) return Promise.resolve();

    log.info(`Refreshing ECS credentials`);
    await ecsCredentials.refreshPromise();
}

export const initialize = async (providedS3Client?: S3Client): Promise<void> => {
    log.info('Initializing S3 Service');
    
    const ecsCredentials = new ECSCredentials();
    let credentials;
    try {
        await ecsCredentials.getPromise();
        log.info('ECS credentials resolved');
        credentials = ecsCredentials;
    } catch(err) {
        log.warn(err);
        log.warn(`Falling back to environment credentials if available`);
        credentials = envCredentials
    }

    if (!credentials) {
        log.error(`Fatal: No credentials available!`)
        process.exit(1)
    }
    
    if (!AWS_REGION) {
        log.warn(`Region not explicitly provided. Using default: ${defaultRegion}`);
    }

    if (process.env.AWS_S3_HOST) {
        log.warn(`The current configuration provides S3 hostname override: ${process.env.AWS_S3_HOST}.`)
    }

    if (!process.env.AWS_BUCKET) {
        log.error(`Fatal: No AWS Bucket defined! Provide a bucketname using the AWS_BUCKET environment variable.`)
        process.exit(1);
    }

    s3Client = providedS3Client || new S3Client({
        region: AWS_REGION || defaultRegion,
        credentials, 
        endpoint: process.env.AWS_S3_HOST || undefined
    });

    log.info('S3 initialization complete');


}


export const putObject = async (key: string, stream: JPEGStream, contentLength: number): Promise<void> => {
    
    await checkEcsCredentialsRefresh();

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
    
    await checkEcsCredentialsRefresh();
    
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
