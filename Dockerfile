# ── Stage 1: build React app ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build

# ── Stage 2: production server ───────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Only copy what's needed to run
COPY package*.json ./
RUN npm install --omit=dev --frozen-lockfile

COPY server.js ./
COPY --from=builder /app/dist ./dist

# Data directory — mount a volume here for persistence
RUN mkdir -p /app/data

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
