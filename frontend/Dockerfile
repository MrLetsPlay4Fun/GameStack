# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve mit nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Build-Artefakte kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx-Konfiguration für React-Router (alle Routen → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
