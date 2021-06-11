FROM node:lts AS build
WORKDIR /app
COPY . .
RUN ["npm", "install"]
RUN ["npm", "run", "build"]

FROM node:lts
WORKDIR /app
RUN mkdir -p /dist/
RUN mkdir -p /node_modules/
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENTRYPOINT ["node", "./dist/app.js"]