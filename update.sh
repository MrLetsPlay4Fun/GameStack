#!/bin/bash
set -e

INSTALL_DIR="/opt/gamestack"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BOLD="\033[1m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}GameStack Update${RESET}"
echo ""

if [ ! -d "$INSTALL_DIR" ]; then
  echo "GameStack nicht gefunden unter $INSTALL_DIR"
  echo "Bitte zuerst install.sh ausführen."
  exit 1
fi

cd "$INSTALL_DIR"

echo -e "${YELLOW}→ Neueste Version wird heruntergeladen…${RESET}"
git pull --quiet
echo -e "${GREEN}✓ Code aktualisiert${RESET}"

echo -e "${YELLOW}→ Container werden neu gebaut und gestartet…${RESET}"
docker compose up -d --build

echo ""
echo -e "${GREEN}${BOLD}✅ GameStack erfolgreich aktualisiert!${RESET}"
echo ""
