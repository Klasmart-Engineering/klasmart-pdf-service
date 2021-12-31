# Startup S3 ninja
echo "Starting s3-ninja Container"
docker pull scireum/s3-ninja:7.0
S3_NINJA_HASH=$(docker run -d -p 9872:9000 scireum/s3-ninja:7.1.1) 

echo "Waiting for S3-Ninja startup"
sleep 10

# Move PDFs used for integration tests to assets folder
cp ./__tests__/integration/resources/invalid.pdf ./src/testing-pdfs/assets/integration-invalid.pdf
cp ./__tests__/integration/resources/long.pdf ./src/testing-pdfs/assets/integration-long.pdf
cp ./__tests__/integration/resources/valid.pdf ./src/testing-pdfs/assets/integration-valid.pdf


# Configure ENV variables for S3 Ninja usage
export AWS_SECRET_KEY=$(docker exec $S3_NINJA_HASH cat /home/sirius/app/application.conf | grep "awsSecretKey" | grep -o '".*"' | sed 's/"//g')
export AWS_SECRET_KEY_NAME=$(docker exec $S3_NINJA_HASH cat /home/sirius/app/application.conf | grep "awsAccessKey" | grep -o '".*"' | sed 's/"//g')
export AWS_REGION=ap-northeast-2
export AWS_BUCKET=kidsloop-pdf-pages-integration-tests
export AWS_S3_HOST=http://localhost:9872

# Run tests
npm run test:integration

# Clean up
docker stop $S3_NINJA_HASH

# CLean up PDF documents
rm ./src/testing-pdfs/assets/integration-invalid.pdf
rm ./src/testing-pdfs/assets/integration-long.pdf
rm ./src/testing-pdfs/assets/integration-valid.pdf
