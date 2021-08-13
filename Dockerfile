# ---- Build ----
FROM node:lts AS build
WORKDIR /root/app
RUN npm install -g gulp
COPY tsconfig.json tsconfig.json
COPY post-install.sh post-install.sh
COPY ./package*.json ./
COPY ./node_modules ./node_modules
COPY src/ src/
RUN sh ./post-install.sh
ENTRYPOINT ["npx", "ts-node", "./src/app.ts"]
