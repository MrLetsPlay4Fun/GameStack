FROM node:22-slim

# System-Abhängigkeiten für Prisma + native Module
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    wget \
    && mkdir -p /etc/apt/keyrings \
    && wget -qO /etc/apt/keyrings/adoptium.asc https://packages.adoptium.net/artifactory/api/gpg/key/public \
    && . /etc/os-release \
    && echo "deb [signed-by=/etc/apt/keyrings/adoptium.asc] https://packages.adoptium.net/artifactory/deb ${VERSION_CODENAME} main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update \
    && apt-get install -y temurin-21-jre \
    && apt-get remove -y wget \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Abhängigkeiten zuerst (besseres Layer-Caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Prisma-Schema kopieren und Client generieren
COPY prisma ./prisma
RUN npx prisma generate

# Quellcode kopieren
COPY src ./src

# Daten-Verzeichnisse anlegen
RUN mkdir -p /data/servers /data/backups

# Port freigeben
EXPOSE 3001

# Datenbank migrieren und Server starten
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
