FROM node:22-alpine AS deps
RUN npm config set fetch-retries 6 && npm config set fetch-retry-mintimeout 5000 && npm i -g pnpm@10.29.2
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm config set fetch-retries 6 && pnpm install --frozen-lockfile --config.minimumReleaseAge=0

FROM node:22-alpine AS build
RUN npm config set fetch-retries 6 && npm config set fetch-retry-mintimeout 5000 && npm i -g pnpm@10.29.2
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/data/snapshot ./data/snapshot
COPY --from=build /app/data/sample-places.json /app/data/sample-reports.json ./data/
RUN mkdir -p /app/data/store && chown -R node:node /app/data
USER node
ENV CACHE_DIR=/app/data/store/cache REPORTS_FILE=/app/data/store/reports.json
EXPOSE 3000
CMD ["node", "server.js"]
