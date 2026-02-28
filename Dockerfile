FROM node:22-slim AS builder
WORKDIR /app
# better-sqlite3 needs build tools for native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV JEOPARDY_DB_PATH=/app/data/jeopardy.db
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/tailwind.config.ts ./
COPY --from=builder /app/postcss.config.mjs ./
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "--experimental-transform-types", "server.ts"]
