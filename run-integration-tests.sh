# Removing Docker containers if they already exist
docker stop pdf-int-s3 || true && docker rm pdf-int-s3 || true
docker stop pdf-int-pg || true && docker rm pdf-int-pg || true

# Startup S3 ninja
echo "Starting s3-ninja Container"
docker pull scireum/s3-ninja:7.0
S3_NINJA_HASH=$(docker run --name pdf-int-s3 -d -p 9872:9000 scireum/s3-ninja:7.1.1) 

echo "Starting PostgreSQL Instance"
docker pull postgres
PG_HASH=$(docker run --name pdf-int-pg -e POSTGRES_PASSWORD=abcdefg -d -p 9999:5432 postgres) 

echo "Waiting for S3-Ninja startup"
sleep 10

# Configure ENV variables for S3 Ninja usage
export AWS_SECRET_KEY=$(docker exec $S3_NINJA_HASH cat /home/sirius/app/application.conf | grep "awsSecretKey" | grep -o '".*"' | sed 's/"//g')
export AWS_SECRET_KEY_NAME=$(docker exec $S3_NINJA_HASH cat /home/sirius/app/application.conf | grep "awsAccessKey" | grep -o '".*"' | sed 's/"//g')
export AWS_REGION=ap-northeast-2
export AWS_BUCKET=kidsloop-pdf-pages-integration-tests
export AWS_S3_HOST=http://localhost:9872

# Configure ENV variables for PostgreSQL
export DB_HOST=localhost
export DB_PORT=9999
export DB_USER=postgres
export DB_DATABASE=postgres
export DB_PASSWORD=abcdefg

# App Config
export LOG_LEVEL=silly
export LOG_STYLE=SILENT
export NEW_RELIC_ENABLED=false
export DEV_JWT_SECRET=pdf-integration-test-secret
export PORT=32892
export CMS_BASE_URL=http://localhost:32892
export EXECUTION_PWD=$(pwd)

# Run tests
nyc ts-mocha "__tests__/integration/*.test.ts"

# Clean up
echo "Cleaning Up"
echo "Stopping S3 Ninja"
docker stop $S3_NINJA_HASH
docker rm $S3_NINJA_HASH
echo "Stopping PostgreSQL Instance"
docker stop $PG_HASH
docker rm $PG_HASH
