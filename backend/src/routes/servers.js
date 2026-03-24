const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { getGameById } = require('../services/gameDefinitionService');
const { startServer, stopServer, restartServer, sendCommand } = require('../services/serverProcessService');
const { installServer, updateServer } = require('../services/installService');
const path = require('path');

// io-Instanz wird beim Start gesetzt
let _io = null;
function setIo(io) { _io = io; }

const SERVERS_BASE_PATH = process.env.SERVERS_PATH || path.join(__dirname, '../../data/servers');

// GET /api/servers – alle Server des eingeloggten Users
router.get('/', requireAuth, async (req, res) => {
  try {
    const servers = await prisma.server.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(servers);
  } catch (err) {
    console.error('[Servers] Fehler:', err);
    res.status(500).json({ error: 'Server konnten nicht geladen werden.' });
  }
});

// GET /api/servers/:id – einzelner Server
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    res.json(server);
  } catch (err) {
    res.status(500).json({ error: 'Server konnte nicht geladen werden.' });
  }
});

// POST /api/servers – neuen Server erstellen
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, gameType, port, config } = req.body;

    if (!name || !gameType) {
      return res.status(400).json({ error: 'Name und Spieltyp sind erforderlich.' });
    }

    // Game-Definition prüfen
    const game = getGameById(gameType);
    if (!game) return res.status(400).json({ error: 'Unbekannter Spieltyp.' });

    // Port-Konflikt prüfen
    const existingPort = await prisma.server.findFirst({ where: { port: Number(port) } });
    if (existingPort) {
      return res.status(400).json({ error: `Port ${port} ist bereits belegt.` });
    }

    const dataPath = path.join(SERVERS_BASE_PATH, `${gameType}_${Date.now()}`);

    const server = await prisma.server.create({
      data: {
        name,
        gameType,
        port: Number(port) || game.defaultPort,
        dataPath,
        config: JSON.stringify(config || game.defaultConfig),
        userId: req.user.id,
      },
    });

    res.status(201).json(server);
  } catch (err) {
    console.error('[Servers] Erstellen fehlgeschlagen:', err);
    res.status(500).json({ error: 'Server konnte nicht erstellt werden.' });
  }
});

// PATCH /api/servers/:id – Server-Einstellungen aktualisieren
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const { name, port, config, autoRestart } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (autoRestart !== undefined) updateData.autoRestart = Boolean(autoRestart);
    if (port) {
      // Port-Konflikt prüfen (außer eigener Port)
      const conflict = await prisma.server.findFirst({
        where: { port: Number(port), id: { not: server.id } },
      });
      if (conflict) return res.status(400).json({ error: `Port ${port} ist bereits belegt.` });
      updateData.port = Number(port);
    }
    if (config !== undefined) updateData.config = JSON.stringify(config);

    const updated = await prisma.server.update({
      where: { id: server.id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    console.error('[Servers] Update fehlgeschlagen:', err);
    res.status(500).json({ error: 'Einstellungen konnten nicht gespeichert werden.' });
  }
});

// DELETE /api/servers/:id – Server löschen (stoppt ihn automatisch falls er läuft)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    // Automatisch stoppen falls der Server noch läuft
    if (server.status === 'running' || server.status === 'starting') {
      try {
        await stopServer(server.id, _io);
        // Kurz warten damit der Prozess beendet wird
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // Fehler beim Stoppen ignorieren – wir löschen trotzdem
      }
    }

    await prisma.server.delete({ where: { id: server.id } });
    res.json({ message: 'Server gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: 'Server konnte nicht gelöscht werden.' });
  }
});

// POST /api/servers/:id/install – Game-Server-Dateien installieren
router.post('/:id/install', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    if (server.installStatus === 'installing') {
      return res.status(400).json({ error: 'Installation läuft bereits.' });
    }
    // Im Hintergrund starten – Client bekommt Updates via Socket.io
    installServer(server.id, _io).catch(() => {});
    res.json({ message: 'Installation gestartet.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/update – Game-Server-Dateien aktualisieren
router.post('/:id/update', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    if (server.status === 'running') {
      return res.status(400).json({ error: 'Server muss zuerst gestoppt werden.' });
    }
    if (server.installStatus === 'installing') {
      return res.status(400).json({ error: 'Installation/Update läuft bereits.' });
    }
    updateServer(server.id, _io).catch(() => {});
    res.json({ message: 'Update gestartet.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/start
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    if (server.installStatus !== 'installed') {
      return res.status(400).json({ error: 'Server muss zuerst installiert werden.' });
    }
    const pid = await startServer(server.id, _io);
    res.json({ message: 'Server wird gestartet.', pid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/stop
router.post('/:id/stop', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    await stopServer(server.id, _io);
    res.json({ message: 'Server wird gestoppt.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/restart
router.post('/:id/restart', requireAuth, async (req, res) => {
  try {
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    await restartServer(server.id, _io);
    res.json({ message: 'Server wird neu gestartet.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/command – Befehl an Konsole senden
router.post('/:id/command', requireAuth, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'Kein Befehl angegeben.' });
    const server = await prisma.server.findFirst({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    sendCommand(server.id, command);
    res.json({ message: 'Befehl gesendet.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// setIo am Router-Objekt hängen damit es exportiert werden kann
router.setIo = setIo;
module.exports = router;
