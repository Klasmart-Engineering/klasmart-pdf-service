import CloudFront from 'aws-sdk/clients/cloudfront'

const AWS_SECRET_KEY_NAME = process.env.AWS_SECRET_KEY_NAME ?? '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY ?? '';
const CF_URL = process.env.CF_URL ?? ''

if (!AWS_SECRET_KEY_NAME) {
    console.warn('Warning: AWS secret key name appears to be missing or invalid!');
}

if (!AWS_SECRET_KEY) {
    console.warn('Warning: AWS secret key name appears to be missing or invalid!');
}

if (!CF_URL) {
    console.warn('Warning: CloudFront URL does not appear to be defined!');
}

const signer = new CloudFront.Signer(AWS_SECRET_KEY_NAME, AWS_SECRET_KEY);


export const getSignedUrl = async (resource: string, expirationFunction = getExpirationTime) => {
    const cfEndpoint = process.env.CF_ENDPOINT;
    const url = `${cfEndpoint}/${resource}`;
    const expirationEpoch = expirationFunction();
    const options = {
        policy: JSON.stringify({
            'Statement': [{
                'Resource': url,
                'Condition': {
                    'DateLessThan': { 'AWS:EpochTime': expirationEpoch }
                }
            }],
        }),
    }

    return signer.getSignedUrl(options);
}

/**
 * Creates an expiration time of one hour in the future
 */
const getExpirationTime = () => {
    const expiration = new Date();
    expiration.setTime(expiration.getTime() + 1000 * 60 * 60);
    return expiration.valueOf();
}