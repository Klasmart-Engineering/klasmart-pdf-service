FROM node:14.16.1 AS build
COPY . .
RUN ["npm", "install"]
RUN ["npm", "run", "build"]

FROM node:14.16.1
RUN mkdir -p /dist/
RUN mkdir -p /node_modules/
COPY --from=build /dist ./dist
COPY --from=build /node_modules ./node_modules
ENTRYPOINT ["node", "./dist/app.js"]