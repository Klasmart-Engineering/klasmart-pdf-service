#!bin/bash
cp ./src/util/lambda-prerender.js ./index.js
zip lambda.zip index.js
rm index.js
