#!bin/bash
cp ./src/util/lambda-prerender.js ./index.js
zip pdf-prerender-lambda.zip index.js
rm index.js
