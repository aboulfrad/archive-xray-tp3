FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY scripts/install-hooks.mjs scripts/install-hooks.mjs
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
