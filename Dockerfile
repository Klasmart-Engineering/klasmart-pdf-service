# ---- Build ----
FROM node:lts AS build
WORKDIR /root/app
COPY ./package*.json ./
RUN npm ci
RUN npm audit fix
COPY ./ ./
RUN npm run build

# ---- Build ----
FROM node:lts AS runtime-dependencies
WORKDIR /root/app
COPY ./package*.json ./
RUN npm ci --only=production
RUN npm audit fix --only=production

#
# ---- Release ----
FROM node:lts-alpine AS release
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
WORKDIR /root/app
# expose port and define CMD
ENV PORT=8080
EXPOSE 8080
# copy app sources
COPY --from=runtime-dependencies /root/app/node_modules ./node_modules
COPY --from=build /root/app/dist ./dist
CMD node dist/index.js
