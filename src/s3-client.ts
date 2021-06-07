import { PutObjectCommand, PutObjectRequest, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const s3Client: S3Client = undefined;

// TODO - Provide s3Client configuration

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