#!/bin/bash
set -e

# ── GameStack Installer ───────────────────────────────────────────────────────
# Unterstützte Systeme: Ubuntu 20.04+, Debian 11+

REPO_URL="https://github.com/MrLetsPlay4Fun/GameStack"
INSTALL_DIR="/opt/gamestack"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║         GameStack Installer          ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# Root-Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}✗ Bitte als root ausführen: sudo bash install.sh${RESET}"
  exit 1
fi

# Betriebssystem prüfen
if ! command -v apt-get &> /dev/null; then
  echo -e "${RED}✗ Dieses Script unterstützt nur Debian/Ubuntu-basierte Systeme.${RESET}"
  exit 1
fi

echo -e "${GREEN}✓ System-Check bestanden${RESET}"

# ── Docker installieren ────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo ""
  echo -e "${YELLOW}→ Docker wird installiert…${RESET}"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  # Docker GPG-Key hinzufügen
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Docker-Repository hinzufügen
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
    $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}✓ Docker installiert${RESET}"
else
  echo -e "${GREEN}✓ Docker bereits installiert ($(docker --version | cut -d' ' -f3 | tr -d ','))${RESET}"
fi

# ── GameStack herunterladen ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}→ GameStack wird heruntergeladen nach ${INSTALL_DIR}…${RESET}"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}  Vorhandene Installation gefunden – wird aktualisiert.${RESET}"
  cd "$INSTALL_DIR"
  git pull --quiet
else
  apt-get install -y -qq git
  git clone --quiet "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo -e "${GREEN}✓ GameStack heruntergeladen${RESET}"

# ── Konfiguration ─────────────────────────────────────────────────────────────
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo ""
  echo -e "${YELLOW}→ Konfiguration wird erstellt…${RESET}"
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"

  # Zufälligen JWT-Secret generieren
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s/change-this-to-a-random-secret/$JWT_SECRET/" "$INSTALL_DIR/.env"

  echo -e "${GREEN}✓ .env erstellt mit zufälligem JWT-Secret${RESET}"
  echo ""
  echo -e "${YELLOW}  Möchtest du die Konfiguration anpassen? (Port, Domain, Pfade)${RESET}"
  read -r -p "  Jetzt .env bearbeiten? [j/N] " response
  if [[ "$response" =~ ^[jJyY]$ ]]; then
    ${EDITOR:-nano} "$INSTALL_DIR/.env"
  fi
else
  echo -e "${GREEN}✓ Bestehende .env wird verwendet${RESET}"
fi

# ── Daten-Verzeichnisse anlegen ────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR/data/servers" "$INSTALL_DIR/data/backups"
echo -e "${GREEN}✓ Daten-Verzeichnisse erstellt${RESET}"

# ── GameStack starten ──────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}→ GameStack wird gebaut und gestartet…${RESET}"
echo -e "  (Dies kann beim ersten Mal 2-5 Minuten dauern)"
echo ""

cd "$INSTALL_DIR"
docker compose up -d --build

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║        ✅ GameStack erfolgreich installiert!     ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# IP-Adresse ermitteln
SERVER_IP=$(hostname -I | awk '{print $1}')
HTTP_PORT=$(grep HTTP_PORT "$INSTALL_DIR/.env" | cut -d= -f2 | tr -d ' ' || echo "80")
PORT_SUFFIX=$([ "$HTTP_PORT" = "80" ] && echo "" || echo ":$HTTP_PORT")

echo -e "  🌐 GameStack ist erreichbar unter:"
echo -e "     ${BOLD}http://${SERVER_IP}${PORT_SUFFIX}${RESET}"
echo ""
echo -e "  📁 Installations-Verzeichnis: ${INSTALL_DIR}"
echo -e "  📋 Logs anzeigen:             docker compose -f ${INSTALL_DIR}/docker-compose.yml logs -f"
echo -e "  🔄 Neu starten:               docker compose -f ${INSTALL_DIR}/docker-compose.yml restart"
echo -e "  ⏹  Stoppen:                   docker compose -f ${INSTALL_DIR}/docker-compose.yml down"
echo ""
echo -e "  Beim ersten Aufruf wird ein Admin-Account eingerichtet."
echo ""
