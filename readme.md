# Kidsloop-PDF-Service

This service stores and serves PDF content in the form of jpeg images for consumption via Kidsloop Live. Requests provide a PDF URL and a page number, which are then generated/stored via pdf.js and served to the users as jpeg images.

## Authorization
Some endpoints are only accessible with authorization. This is provided by a cookie named access with a JWT describing the user.  In production, this JWT is provided by the auth server. In development you may want to supply a cookie to use manually.  For convenience, one is included here. Note that this cookie is only valid when NODE_ENV is not set to `production` and the DEV_JWT_SECRET is set to `dev-secret`.

JWT: `eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMiwiaXNzIjoiY2FsbWlkLWRlYnVnIiwiaWQiOiJiMDQ1ZTgwMC05NjY4LTQ4ZDgtYmNmOC0yZTY2MWQ1YzgzZTYiLCJlbWFpbCI6ImRldnRlc3RAa2lkc2xvb3AubGl2ZSIsImV4cCI6MjU0Mzg5MTI0NzAwMH0.b-XOD5Jiss3bHhzVtneEsGRXSWylC5_YMQqMlP_RCIUniT28lRrDIz9-iL6Nts7gVzDv-9sasUqFrEn1N_9HIg`

Sample cookie: `access=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMiwiaXNzIjoiY2FsbWlkLWRlYnVnIiwiaWQiOiJiMDQ1ZTgwMC05NjY4LTQ4ZDgtYmNmOC0yZTY2MWQ1YzgzZTYiLCJlbWFpbCI6ImRldnRlc3RAa2lkc2xvb3AubGl2ZSIsImV4cCI6MjU0Mzg5MTI0NzAwMH0.b-XOD5Jiss3bHhzVtneEsGRXSWylC5_YMQqMlP_RCIUniT28lRrDIz9-iL6Nts7gVzDv-9sasUqFrEn1N_9HIg; Path=/; Domain=localhost; Expires=Thu, 11 Aug 2022 07:18:52 GMT;`

## Environment
### App Environment
- PORT - Port that application will listen on. Defaults to 32891.
- ROUTE_PREFIX - Sets the prefix for routing. Defaults to `/pdf`
- LOG_LEVEL (or LEVEL) - Global logging level used by Winston. One of ['silly', 'debug', 'verbose', 'http', 'info', 'warn', 'error']. Defaults to 'debug'. For focused debugging, overrides can be passed to the withLogger function as an optional parameter in individual files.
- LOG_STYLE - one of [STRING_COLOR, STRING, JSON, SILENT]. Configures the output style of logs. String outputs a simple string output. Convenient for human readability. STRING_COLOR uses the same string output as STRING, but allows Winston to embed color metadata which can improve readability when viewed in a terminal. This information is not displayed correctly in some views (Cloudtrail, etc) and so is not recommended for these environments.  JSON style outputs logs in a JSON output, which can be more easily machine parsable and is ideal for higher level log viewers which will need to parse and extract log data. SILENT silences Winston loggers, primarily use for testing.
- CMS_BASE_URL - Base URL of CMS. PDFs will be loaded using a URL pattern with this URL as the base.
- IMAGE_SCALE - (floating point value). Controls the image scale used to render PDF pages. This will affect the resulting size of image and can have significant effects on image quality, particular for JPEGs. If not defined the application will default to a scale of 3.0
- JPEG_QUALITY - (floating point value between 0-1) Controls the level of quality/compression of the JPEG. Higher values reduce JPEG compression artifacts at the cost of additional file size. If not defined the application defaults to 0.99.

### S3 Environment Variables
- AWS_SECRET_KEY_NAME - Name (ID) of AWS secret key with access to S3 bucket - Not needed for deployed services
- AWS_SECRET_KEY - Secret key value with access to S3 bucket - Not needed for deployed services
- AWS_REGION - Bucket region - Not needed for deployed services
- AWS_BUCKET - Bucket name
- AWS_S3_HOST - S3 host address - Used to connect to alternative S3 interface (S3Ninja, min.io, etc). Can be left unconfigured for native AWS S3.

### PostgreSQL Connection Environment Variables
- DB_HOST
- DB_USER
- DB_PORT
- DB_DATABASE
- DB_PASSWORD

### kidsloop-token-validation
- DEV_JWT_SECRET - Development secret for JWT used for testing.

### Lambda Support
This application has an endpoint available to render all pages in a PDF document (/pdf/${filename}/prerender). This endpoint is designed to be called by a cloud function triggered by files being added to CMS bucket storage. This allows for pages to be rendered before the user attempts view them, allowing for faster load times for first usages of PDF document.