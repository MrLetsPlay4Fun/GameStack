# GameStack – Release Notes

---

## v0.1.2-beta — 2026-03-24

### Bugfixes
- **Minecraft-Installation**: `curl` durch natives Node.js `fetch` ersetzt – kein `curl` auf dem Server mehr nötig
- **Minecraft-Start**: Java 21 (Temurin) wird jetzt automatisch im Docker-Image installiert
- **Game-Server-Ports**: Backend nutzt jetzt `network_mode: host` – alle Server-Ports sind direkt am Host erreichbar ohne manuelle Port-Freigaben

### Neu
- **Minecraft-Versions-Dropdown**: Versionsauswahl beim Erstellen und in den Einstellungen
  - „⭐ Neueste Version" als Standardoption (automatisch die aktuellste Paper-Version)
  - Alle verfügbaren Paper-Versionen werden live von papermc.io geladen
  - Nach Versionsänderung in den Einstellungen erscheint ein „Jetzt updaten"-Button

---

## v0.1.1-beta — 2025-03-24

### Neu
- **Server-Installation** – Game-Server-Dateien werden direkt aus GameStack heraus installiert
  - Minecraft: Paper JAR wird automatisch von papermc.io heruntergeladen (Version wählbar)
  - Valheim, CS2, Palworld: SteamCMD wird einmalig eingerichtet und der Server per AppID installiert
  - EULA für Minecraft wird automatisch akzeptiert
  - Installationsfortschritt wird live in der Konsole gestreamt
- **Server-Update** – Bereits installierte Server können per Klick aktualisiert werden (inkrementell via SteamCMD)
- **Auto-Restart bei Absturz** – Server startet automatisch neu wenn er unerwartet abstürzt
  - Maximal 3 Versuche innerhalb von 5 Minuten
  - Manuelles Stoppen löst keinen Neustart aus
  - Aktivierbar per Toggle in den Server-Einstellungen
- **Minecraft-Version wählbar** – In den Server-Einstellungen kann die gewünschte Paper-Version angegeben werden (Standard: 1.21.4)

### Verbesserungen
- Start-Button ist deaktiviert solange der Server nicht installiert ist
- Übersichts-Tab zeigt Installations-Status mit direktem Aktions-Button
- Klick auf „Installieren" wechselt automatisch zur Konsole

---

## v0.1.0-beta — 2025-03-24

### Erstveröffentlichung

#### Authentifizierung
- Login-System mit JWT und bcrypt (Passwort-Hashing Faktor 12)
- Setup-Wizard beim ersten Start – Admin-Account direkt im Browser anlegen
- Rate-Limiting auf Login- und Setup-Endpunkt (max. 10 Versuche / 15 Min.)
- Passwort-Mindestlänge: 12 Zeichen
- JWT_SECRET-Validierung beim Start verhindert unsichere Produktivkonfiguration

#### Server-Verwaltung
- Server erstellen (Spiel auswählen, Name, Port, spielspezifische Konfiguration)
- Server starten, stoppen, neu starten
- Server löschen (stoppt laufende Server automatisch)
- Port-Konflikt-Prüfung beim Erstellen und Bearbeiten
- Unterstützte Spiele: Minecraft (Paper), Valheim, CS2, Palworld

#### Live-Konsole
- Echtzeit-Log-Streaming via Socket.io (WebSocket)
- Befehle direkt aus dem Browser an die Server-Konsole senden
- Konsolenausgabe leeren
- Auto-Scroll mit manuellem Override

#### Ressourcen-Monitoring
- CPU-Auslastung live (alle 5 Sekunden)
- RAM-Verbrauch live
- CPU-Balken mit Farbindikator (grün / gelb / rot)
- Anzeige im Header und im Übersichts-Tab

#### Backup-System
- Manuelles Backup per Klick (tar.gz-Archiv)
- Backup-Liste mit Größe, Datum und Typ (manuell / automatisch)
- Backup wiederherstellen (nur wenn Server gestoppt)
- Backup löschen
- Automatische Backups mit node-cron (stündlich bis wöchentlich, Uhrzeit wählbar)
- Maximale Anzahl aufbewahrter Backups konfigurierbar (1–20)

#### Geplante Aufgaben
- Aufgaben mit Namen und Befehlsfolge erstellen
- Intervall wählbar: alle 5 Min. bis wöchentlich, täglich/wöchentlich mit Uhrzeitauswahl
- Befehle in der Reihenfolge verschieben (↑↓)
- Aufgaben aktivieren/deaktivieren per Toggle
- Letzter Ausführungszeitpunkt wird angezeigt

#### Whitelist & Banliste
- Spieler zur Whitelist hinzufügen und entfernen (Minecraft, Valheim)
- Spieler bannen und Ban aufheben (alle Spiele außer Minecraft-Whitelist)
- Spielspezifische Dateiformate (JSON, Plaintext, CFG)
- Nicht unterstützte Spiele erhalten einen informativen Hinweis

#### Einstellungen
- Servername und Port ändern
- Spielspezifische Konfigurationsfelder (z.B. Map, Max. Spieler, Schwierigkeit)
- Whitelist aktivieren/deaktivieren (Minecraft)
- Server löschen mit Bestätigungsdialog

#### Benutzeroberfläche
- Modernes Dark-Mode-Design (Discord-ähnlich)
- Sidebar mit Serverliste und Live-Statusanzeige (grüner Punkt)
- Versionsnummer im Sidebar-Header
- Responsive Layout
- Tab-Navigation auf der Server-Detailseite

#### Deployment
- Docker Compose Setup (Backend + Frontend via nginx)
- Ein-Klick-Installer für Ubuntu/Debian (`install.sh`)
- Update-Script (`update.sh`)
- Umgebungsvariablen via `.env`
- API-URL wird zur Build-Zeit eingebettet (Dev vs. Produktion)
- nginx-Proxy für `/api/` und `/socket.io/`

---

*GameStack ist ein Open-Source-Projekt – Beiträge und Feedback sind willkommen.*
