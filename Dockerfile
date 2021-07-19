# ---- Build ----
FROM node:lts AS build
WORKDIR /root/app
COPY ./package*.json ./
RUN npm ci --only=production
RUN npm audit fix
RUN sh ./post-install.sh
COPY src/ src/
COPY tsconfig.json tsconfig.json
ENTRYPOINT ["npx", "ts-node", "./src/app.ts"]

