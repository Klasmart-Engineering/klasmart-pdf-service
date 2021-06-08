import { GetObjectCommand, GetObjectRequest, PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';

const s3Client: S3Client = new S3Client({
    credentials: {
        accessKeyId: AWS_SECRET_KEY_NAME,
        secretAccessKey: AWS_SECRET_KEY
    }
});

export const writeObject = async (key: string, stream: Readable): Promise<any> => {
    const request: PutObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        Body: stream
    }

    const command = new PutObjectCommand(request);
    await s3Client.send(command);
    
    // Promise resolved separately to block access to the s3 response metadata as this information 
    // should not be needed outside of this class
    return Promise.resolve();
}

export const readObject = async (key: string): Promise<Readable> => {
    const request: GetObjectRequest = {
        Bucket: process.env.AWS_BUCKET,
        Key: key
    };
    const command = new GetObjectCommand(request);
    const response = await s3Client.send(command);
    return response.Body as Readable;
}