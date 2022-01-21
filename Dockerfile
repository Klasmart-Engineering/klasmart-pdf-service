# ---- Build ----
FROM node:14.16 AS pdf-build
WORKDIR /root/app
RUN mkdir node_modules

FROM node:14.16 AS build
WORKDIR /root/app
COPY ./node_modules ./node_modules
COPY tsconfig.json tsconfig.json
COPY ./package*.json ./
COPY ./api.yaml ./api.yaml
COPY src/ src/
COPY docker-startup.sh ./
ENTRYPOINT ["sh", "./docker-startup.sh"]
