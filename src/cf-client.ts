import CF from '@aws-sdk/client-cloudfront'
import crypto from 'crypto';
import awsCrypto from '@aws-sdk/crypto';

/* We don't actually need to communicate with CloudFront here, we just need to write the signatures for requests */


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

    // TODO - what is the actual hash function used by AWS?
    const hash = crypto.createHash('sha256');
    hash.write(options.policy);
    hash.end();
    const digest = hash.digest().toString();
}

/**
 * Creates an expiration time of one hour in the future
 */
const getExpirationTime = () => {
    const expiration = new Date();
    expiration.setTime(expiration.getTime() + 1000 * 60 * 60);
    return expiration.valueOf();
}