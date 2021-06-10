# Kidsloop-PDF-Service

This service stores and serves PDF content in the form of jpeg images for consumption via Kidsloop Live. Requests provide a PDF URL and a page number, which are then generated/stored via pdf.js and served to the users as jpeg images.

## Environment
### App Environment
- PORT - Port that application will listen on. Defaults to 32891.

### S3 Environment Variables
- AWS_SECRET_KEY_NAME - Name (ID) of AWS secret key with access to S3 bucket
- AWS_SECRET_KEY - Secret key value with access to S3 bucket
- AWS_REGION - Bucket region
- AWS_BUCKET - Bucket name
- AWS_S3_HOST - S3 host address - Used to connect to alternative S3 interface (S3Ninja, min.io, etc). Can be left unconfigured for native AWS S3.

### PostgreSQL Connection Environment Variables
- DB_HOST
- DB_USER
- DB_PORT
- DB_DATABASE
- DB_PASSWORD