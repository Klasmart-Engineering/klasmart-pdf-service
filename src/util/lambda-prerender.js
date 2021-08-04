const aws = require('aws-sdk');
const http = require('http');

exports.handler = async (event, context, callback) => {
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    if (key.endsWith('.pdf')) {
        http.get(`${process.env.PDF_SERVICE}/pdf/${key}/prerender`, (res) => {
            callback(null, res.statusCode)
        })
        .on('error', (err) => {
            callback(err)
        })
        .on('abort', (err) => {
            callback(err);
        })
        .on('timeout', () => {
            callback(new Error('timeout'))
        });
    }
}
