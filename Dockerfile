# ---- Build ----
FROM node:lts AS pdf-build
WORKDIR /root/app
RUN npm install -g gulp
COPY post-install.sh post-install.sh
RUN mkdir node_modules
RUN sh ./post-install.sh

FROM node:lts AS build
WORKDIR /root/app
COPY ./node_modules ./node_modules
COPY --from=pdf-build /root/app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY tsconfig.json tsconfig.json
COPY ./package*.json ./
COPY ./api.yaml ./api.yaml
COPY src/ src/
ENTRYPOINT ["npx", "ts-node", "./src/app.ts"]
