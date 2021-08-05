# ---- Build ----
FROM node:lts AS build
WORKDIR /root/app
COPY ./package*.json ./
RUN npm ci --only=production
RUN npm audit fix
RUN npm install -g gulp
COPY src/ src/
COPY tsconfig.json tsconfig.json
COPY post-install.sh post-install.sh
RUN sh ./post-install.sh
ENTRYPOINT ["npx", "ts-node", "./src/app.ts"]
