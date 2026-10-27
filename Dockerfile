FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm install --omit=dev
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
RUN mkdir -p server/data
EXPOSE 4000
CMD ["npm","--workspace","server","start"]
