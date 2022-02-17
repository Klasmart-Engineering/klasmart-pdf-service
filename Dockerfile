# ---- Build ----
FROM node:16.6 AS pdf-build
WORKDIR /root/app
RUN mkdir node_modules

FROM node:16.6 AS build
WORKDIR /root/app
COPY ./node_modules ./node_modules
COPY tsconfig.json tsconfig.json
COPY ./package*.json ./
COPY ./api.yaml ./api.yaml
COPY ./dist ./dist
COPY docker-startup.sh ./
COPY ./ormconfig.ts ./
COPY ./migration ./migration
ENTRYPOINT ["sh", "./docker-startup.sh"]
