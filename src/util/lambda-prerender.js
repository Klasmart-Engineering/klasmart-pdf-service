const https = require('https');

exports.handler = (event, context, callback) => {
    const fullKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    console.log(`Full Key: ${fullKey}`);
    const key = fullKey.split('/').pop();
    console.log(`Operational part of key: ${key}`)
    if (fullKey.startsWith('assets') && key.endsWith('.pdf')) {
        const address = `${process.env.PDF_SERVICE}/pdf/${key}/prerender`;
        console.log(`Sending webhook to: ${address}`)
        https.get(address, (res) => {
            callback(null, res.statusCode)
        })
        .on('error', (err) => {
            console.log('error', err)
            callback(err)
        })
        .on('abort', (err) => {
            console.log('abort', err)
            callback(err);
        })
        .on('timeout', () => {
            console.log('timeout');
            callback(new Error('timeout'));
        });
    } else {
        console.log('Non operational key');
        callback(null, 204);
    }
}
