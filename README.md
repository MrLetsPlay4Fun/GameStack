# GameStack

Ein moderner, webbasierter Game-Server-Manager für Linux.

Verwalte deine Game-Server (CS2, Valheim, Minecraft, Palworld und mehr) über ein übersichtliches Webinterface – mit Live-Logs, automatischen Backups und geplanten Aufgaben.

![Dark Mode UI](docs/screenshot.png)

## Features

- **Server-Verwaltung** – Erstellen, starten, stoppen, neu starten
- **Live-Konsole** – Logs in Echtzeit, Befehle direkt senden
- **Backup-System** – Manuell & automatisch (täglich, wöchentlich, …)
- **Geplante Aufgaben** – Befehle automatisch per Timer ausführen
- **Whitelist & Banliste** – Spieler verwalten (Minecraft, Valheim)
- **Ressourcen-Monitoring** – CPU & RAM live im Blick
- **Einzel-Klick-Installation** via Docker

---

## Schnellinstallation (Ubuntu / Debian)

```bash
curl -sSL https://raw.githubusercontent.com/ahippler/GameStack/main/install.sh | sudo bash
```

Das Script:
1. Installiert Docker automatisch (falls nicht vorhanden)
2. Lädt GameStack herunter nach `/opt/gamestack`
3. Generiert einen sicheren JWT-Secret
4. Startet alles mit Docker Compose

Nach der Installation ist GameStack unter `http://<server-ip>` erreichbar.
Beim ersten Aufruf wird ein Admin-Account angelegt.

---

## Manuelle Installation

```bash
# 1. Repository klonen
git clone https://github.com/ahippler/GameStack /opt/gamestack
cd /opt/gamestack

# 2. Konfiguration anlegen
cp .env.example .env
nano .env   # JWT_SECRET mit "openssl rand -hex 32" generieren!

# 3. Daten-Verzeichnisse anlegen
mkdir -p data/servers data/backups

# 4. Starten
docker compose up -d --build
```

---

## Konfiguration (.env)

| Variable | Beschreibung | Standard |
|---|---|---|
| `JWT_SECRET` | Sicherheitsschlüssel – **muss geändert werden!** | — |
| `FRONTEND_URL` | URL des Frontends (für CORS) | `http://localhost` |
| `HTTP_PORT` | Port auf dem GameStack erreichbar ist | `80` |
| `SERVERS_PATH` | Pfad für Game-Server-Daten | `./data/servers` |
| `BACKUPS_PATH` | Pfad für Backups | `./data/backups` |

**JWT_SECRET generieren:**
```bash
openssl rand -hex 32
```

---

## Update

```bash
sudo bash /opt/gamestack/update.sh
```

Oder manuell:
```bash
cd /opt/gamestack
git pull
docker compose up -d --build
```

---

## Nützliche Befehle

```bash
# Logs anzeigen
docker compose logs -f

# Nur Backend-Logs
docker compose logs -f backend

# Neu starten
docker compose restart

# Stoppen
docker compose down

# Stoppen + Daten löschen (Vorsicht!)
docker compose down -v
```

---

## Lokale Entwicklung (Windows / Mac / Linux)

**Voraussetzungen:** Node.js 20+, npm

```bash
# Backend
cd backend
cp .env.example .env    # JWT_SECRET etc. eintragen
npm install
npx prisma migrate dev --name init
npm run dev             # läuft auf http://localhost:3001

# Frontend (neues Terminal)
cd frontend
npm install
npm run dev             # läuft auf http://localhost:5173
```

---

## Unterstützte Spiele

| Spiel | Typ | Whitelist | Banliste |
|---|---|---|---|
| Minecraft (Paper) | Java | ✅ | ✅ |
| Valheim | SteamCMD | ✅ | ✅ |
| CS2 | SteamCMD | — | ✅ |
| Palworld | SteamCMD | — | ✅ |

Neue Spiele lassen sich einfach durch eine JSON-Datei in `backend/src/gameDefinitions/` hinzufügen.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Backend | Node.js + Express + Socket.io |
| Frontend | React + Vite + Tailwind CSS |
| Datenbank | SQLite via Prisma ORM |
| Echtzeit | Socket.io (Live-Logs, Stats) |
| Zeitpläne | node-cron |
| Deployment | Docker Compose |

---

## Sicherheit

- JWT-Authentifizierung mit konfigurierbarem Secret
- Rate-Limiting auf Login- und Setup-Endpunkten
- Passwörter mit bcrypt gehasht (Faktor 12)
- Alle Server-Operationen erfordern Authentifizierung
- Produktionsstart wird verhindert wenn JWT_SECRET unsicher ist

---

## Lizenz

MIT – siehe [LICENSE](LICENSE)
