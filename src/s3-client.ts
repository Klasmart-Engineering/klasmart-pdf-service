import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { JPEGStream } from 'canvas';

const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';
const AWS_REGION = process.env.AWS_REGION ?? ''

const s3Client: S3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_SECRET_KEY_NAME,
        secretAccessKey: AWS_SECRET_KEY
    },
    endpoint: process.env.AWS_S3_HOST || undefined
});

export const putObject = async (key: string, stream: JPEGStream): Promise<void> => {
    const request: PutObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        ContentType: 'image/jpeg',
        Body: Readable.from(stream)
    }

    const command = new PutObjectCommand(request);

    console.log(`Sending S3 object creation request: ${key}`);
    try {
        await s3Client.send(command);
    } catch (err){
        console.error(err.message);
        throw err;
    }
    console.log('s3 upload complete');
    return Promise.resolve();
}

export const readObject = async (key: string): Promise<Readable> => {
    console.log(`retrieving S3 object: ${key}`);
    const request: GetObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key
    };

    const command = new GetObjectCommand(request);
    console.log('sending object request');
    const response = await s3Client.send(command);
    return response.Body as Readable;
}