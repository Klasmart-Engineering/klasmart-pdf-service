## [0.5.2](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.4.4...v0.5.2) (2022-03-02)


### Features

* **metadata:** add additional pdf processing steps to store pdf outline, page index metadata, add /metadata pdf endpoint to retrieve data ([fc35ee8](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/fc35ee879414fc457ef2633a8cc0590be80f5cf1))



## [0.4.4](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.4.3...v0.4.4) (2022-02-08)



## [0.4.3](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.4.2...v0.4.3) (2022-02-08)



## [0.4.2](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30...v0.4.2) (2022-02-08)


### Features

* **KLL-2497:** create v2 router to allow for CMS path resolution, updated pdf-service, pdf-v2-router configuration ([efd9c83](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/efd9c83ce0b2708a9856578fcf9844359a3aacc3))
* **KLL-2498:** add v2 api for ws validation apis ([469f0b6](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/469f0b6d5f10cee7db24a5bea009cb0b5155f8e6))



## [0.3.30](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30-dev.4...v0.3.30) (2022-01-04)



## [0.3.30-dev.4](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30-dev.3...v0.3.30-dev.4) (2021-12-30)



## [0.3.30-dev.3](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30-dev.2...v0.3.30-dev.3) (2021-12-23)


### Bug Fixes

* fixed issue that allowed pdf documents with invalid page content to pass validation on ws:/pdf/v2/validate endpoint ([3c052f1](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/3c052f15e28eabf03fe5ac738e4281b2c690b3a2))



## [0.3.30-dev.2](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30-dev.1...v0.3.30-dev.2) (2021-12-16)



## [0.3.30-dev.1](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.30-dev.0...v0.3.30-dev.1) (2021-12-14)


### Bug Fixes

* minor script reordering to bitbucket dev pipeline docker build step ([a30b9b7](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/a30b9b7d790b7c6da517e12b48f902a1eb167c80))



## [0.3.30-dev.0](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.29...v0.3.30-dev.0) (2021-12-14)


### Bug Fixes

* **KLL-2128:** reenable validation checks for v2 validation api methods ([ffc4f88](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/ffc4f88eacf7dd930f13147f3d240f7eec333831))


### Features

* **KLL-1935:** integrate intersection api to pug template for view.html ([bd7fe80](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/bd7fe80634271de69dd6add7923f514f950c5ab8))
* **KLL-2129:** implementation of async validation check API ([b7a74fa](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/b7a74fa04ed7c8204e194531c8f5eb2683633707))



## [0.3.29](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.28...v0.3.29) (2021-12-06)


### Bug Fixes

* **KLL-1906:** update styles to fix aspect ratio breaking on some devices ([cd17c08](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/cd17c0850ea83ca62d20f6f83a8c61a60d047203))



## [0.3.28](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.27...v0.3.28) (2021-12-03)


### Bug Fixes

* **CMS-241:** Add Access-Control-Allow-Credentials CORS header to responses ([af55353](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/af5535319a1e0d24ef9c90397d35d96be3887411))



## [0.3.27](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.26...v0.3.27) (2021-12-02)



## [0.3.26](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.25...v0.3.26) (2021-12-02)



## [0.3.25](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.24...v0.3.25) (2021-12-02)


### Bug Fixes

* **KLL-1935:** set threshold to 0 to allow better flexibility for iframe usage ([d7cbac7](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/d7cbac7b15a503c1c839c7ec9209a3917c4be324))



## [0.3.24](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.23...v0.3.24) (2021-12-02)


### Bug Fixes

* **1935:** reorganize initialization logic for intersection api implementation ([0a4b1e7](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/0a4b1e7cabe470cc8768af1990af6bd4ca22527d))



## [0.3.23](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.22...v0.3.23) (2021-12-02)


### Bug Fixes

* **KLL-1935:** fix issue with image size adjustment script causing script execution to fail on page load ([08c532b](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/08c532b39be3eadfd692b6b1d31a797b445e5edc))



## [0.3.22](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.21...v0.3.22) (2021-12-01)


### Bug Fixes

* **KLL-2153:** Add configurable domain for validating CORS allowed origins ([bed1ebd](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/bed1ebd84b7716ece443dec6314da2e99862057d))
* **lambda:** fix lambda logic to prevent premature termination of lambda session ([697a6b7](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/697a6b7e78380578df072b711936b8a2974efcf9))


### Features

* **KLL-1935:** integrate intersection api to pug template for view.html ([20d0134](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/20d01340f9166bfc0abffdb8db3150bb11dfca94))



## [0.3.21](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.20...v0.3.21) (2021-11-23)


### Bug Fixes

* **pipeline:** replace node script for python script as when semvar is calculated pipeline is running in a python container ([3d2c033](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/3d2c033fc49a61a0987eefacdb6d252a2367caa0))



## [0.3.20](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.19...v0.3.20) (2021-11-11)


### Bug Fixes

* **KLL-1913:** remove old testing code that wrote file to OS with potentially bad path ([5f99d61](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/5f99d61ed8d9e7af101e83ed14bc637475e6eeb8))



## [0.3.19](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.18...v0.3.19) (2021-11-11)


### Bug Fixes

* update bitbucket pipeline node versions to match Dockerfile version ([061eb4d](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/061eb4d7104437a4effb25053a1a6771822774ab))



## [0.3.18](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.17...v0.3.18) (2021-11-11)


### Bug Fixes

* **KLL-1913:** add catch to deletion of tempFile in pdf-service to prevent crash due to async error ([0c96475](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/0c96475d9aee25d0b97d8df3c1b74b3ce1dfb479))



## [0.3.17](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.16...v0.3.17) (2021-11-11)


### Bug Fixes

* Add additional conditional log to catch silent errors and log content length from s3 responses ([864895c](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/864895c1756d4c0d3e4b80caefab7ca80c700c35))
* Configure Dockerfile to use node:14.16 rather than lts to match build version of canvas via pdf.js ([d0608d2](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/d0608d21a9e9d27c703b68c56e30af7e037f55f1))



## [0.3.16](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.15...v0.3.16) (2021-11-04)


### Bug Fixes

* bumped logger version to consistently provide entity.guid value in logs ([f47419a](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/f47419ac688a6926436794dbf7c3701a8d419498))



## [0.3.15](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.14...v0.3.15) (2021-11-04)


### Bug Fixes

* update logger version to 0.2.9 to fix problem deliverying first payload of logs ([c4d1e61](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/c4d1e614032d68a4b7c92cde0e92a4bf87765ff5))



## [0.3.14](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.13...v0.3.14) (2021-11-04)


### Bug Fixes

* **logger:** bump version of logger to 0.2.5 ([542714e](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/542714eed944ee232935df30e496d62eee4f331e))
* update logger version to 0.2.7 ([7f9b37e](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/7f9b37e98cce2aa30a0ecedddc799d8d2e4e7b48))



## [0.3.13](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.12...v0.3.13) (2021-11-03)



## [0.3.12](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.11...v0.3.12) (2021-11-03)


### Bug Fixes

* **pipeline:** add production flag to audit fix ([7b96f1c](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/7b96f1ce4eab5c63cdaa3a200c4111bf19ce586b))



## [0.3.11](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.10...v0.3.11) (2021-11-03)



## [0.3.10](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.9...v0.3.10) (2021-10-29)



## [0.3.9](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.8...v0.3.9) (2021-10-25)



## [0.3.8](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.7...v0.3.8) (2021-10-25)


### Bug Fixes

* bump logger version to fix unnecessary log dump issue ([3c5d62b](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/3c5d62b25f4dc88b215ba5ddff3ce8c37c3eade4))



## [0.3.7](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.6...v0.3.7) (2021-10-25)


### Features

* bump version of logging service to v0.1.14 to test integration ([e82c881](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/e82c8817cfec73abe57d8615aa3139474f617124))



## [0.3.6](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.5...v0.3.6) (2021-10-25)


### Bug Fixes

* regenerate package-lock ([342ebac](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/342ebac3c8be76d0644ea786224490d8acde3dc6))



## [0.3.5](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/v0.3.3...v0.3.5) (2021-10-25)


### Features

* bump version of logging service to test integration ([33555ac](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/33555acf997c055faa572e2bb545641e9df72b33))



## [0.3.3](https://bitbucket.org/calmisland/kidsloop-pdf-service/compare/0.1.1-release-candidate...v0.3.3) (2021-10-25)


### Features

* bump kl logger version to enable nr log delivery ([3202aaf](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/3202aaf67a4a06f4dc53462d19fe7b1567c1a9bf))
* **logging:** add x-correlation-id headers to pdf.js outgoing requests, bump kidsloop-nodejs-logger version ([24de7d4](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/24de7d4420413dbdb4751d91dc8ffc7ddcf7c490))
* **logging:** remove internal logging util. add kidsloop-nodejs-logger dependency. register correlation middleware. replace imports for internal logger with kidsloop-nodejs-logger version ([24bd2c8](https://bitbucket.org/calmisland/kidsloop-pdf-service/commits/24bd2c853a03d436f3e10ee300ac7561ab9a0402))



