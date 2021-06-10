FROM node:lts AS build
COPY . .
RUN ["npm", "ci" "--no-progress"]
RUN ["npm", "run", "build"]

FROM node:lts
RUN mkdir -p /dist/
RUN mkdir -p /node_modules/
COPY --from=build /dist ./dist
COPY --from=build /node_modules ./node_modules
ENTRYPOINT ["node", "./dist/app.js"]