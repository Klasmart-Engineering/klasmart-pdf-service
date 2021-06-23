# Kidsloop-PDF-Service

This service stores and serves PDF content in the form of jpeg images for consumption via Kidsloop Live. Requests provide a PDF URL and a page number, which are then generated/stored via pdf.js and served to the users as jpeg images.

## Environment
### App Environment
- PORT - Port that application will listen on. Defaults to 32891.
- ROUTE_PREFIX - Sets the prefix for routing. Defaults to `/pdf`
- LOG_LEVEL (or LEVEL) - Global logging level used by Winston. One of ['silly', 'debug', 'verbose', 'http', 'info', 'warn', 'error']. Defaults to 'debug'. For focused debugging, overrides can be passed to the withLogger function as an optional parameter in individual files.
- LOG_STYLE - one of [STRING_COLOR, STRING, JSON, SILENT]. Configures the output style of logs. String outputs a simple string output. Convenient for human readability. STRING_COLOR uses the same string output as STRING, but allows Winston to embed color metadata which can improve readability when viewed in a terminal. This information is not displayed correctly in some views (Cloudtrail, etc) and so is not recommended for these environments.  JSON style outputs logs in a JSON output, which can be more easily machine parsable and is ideal for higher level log viewers which will need to parse and extract log data. SILENT silences Winston loggers, primarily use for testing.

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