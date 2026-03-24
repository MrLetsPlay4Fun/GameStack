const express = require('express');
const router = express.Router({ mergeParams: true });
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { getGameById } = require('../services/gameDefinitionService');

// Hilfsfunktion: Datei lesen und als Array zurückgeben
function readListFile(filePath, format) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];

  if (format === 'json') {
    try { return JSON.parse(content); } catch { return []; }
  }
  // plaintext / cfg: eine Zeile = ein Eintrag
  return content.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Hilfsfunktion: Array in Datei schreiben
function writeListFile(filePath, entries, format) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
  } else {
    fs.writeFileSync(filePath, entries.join('\n') + '\n', 'utf-8');
  }
}

// Server + Game-Definition laden und prüfen
async function loadServerAndGame(serverId, userId) {
  const server = await prisma.server.findFirst({
    where: { id: Number(serverId), userId },
  });
  if (!server) return { error: 'Server nicht gefunden.', status: 404 };

  const game = getGameById(server.gameType);
  if (!game) return { error: 'Game-Definition nicht gefunden.', status: 500 };

  return { server, game };
}

// ─── WHITELIST ────────────────────────────────────────────────────────────────

// GET /api/servers/:id/whitelist
router.get('/whitelist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });

  if (!game.features?.whitelist?.supported) {
    return res.json({ supported: false, note: game.features?.whitelist?.note || '' });
  }

  const filePath = path.join(server.dataPath, game.features.whitelist.file);
  const entries = readListFile(filePath, game.features.whitelist.format);
  res.json({ supported: true, entries, file: game.features.whitelist.file, note: game.features.whitelist.note });
});

// POST /api/servers/:id/whitelist – Spieler hinzufügen
router.post('/whitelist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });
  if (!game.features?.whitelist?.supported) return res.status(400).json({ error: 'Whitelist nicht unterstützt.' });

  const { entry } = req.body;
  if (!entry) return res.status(400).json({ error: 'Kein Eintrag angegeben.' });

  const filePath = path.join(server.dataPath, game.features.whitelist.file);
  const entries = readListFile(filePath, game.features.whitelist.format);

  // Duplikat prüfen
  const isDuplicate = game.features.whitelist.format === 'json'
    ? entries.some((e) => e.name === entry || e.uuid === entry)
    : entries.includes(entry);

  if (isDuplicate) return res.status(400).json({ error: 'Spieler ist bereits auf der Whitelist.' });

  const newEntry = game.features.whitelist.format === 'json'
    ? { name: entry, uuid: '' }
    : entry;

  entries.push(newEntry);
  writeListFile(filePath, entries, game.features.whitelist.format);
  res.json({ message: 'Spieler zur Whitelist hinzugefügt.', entries });
});

// DELETE /api/servers/:id/whitelist – Spieler entfernen
router.delete('/whitelist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });
  if (!game.features?.whitelist?.supported) return res.status(400).json({ error: 'Whitelist nicht unterstützt.' });

  const { entry } = req.body;
  const filePath = path.join(server.dataPath, game.features.whitelist.file);
  let entries = readListFile(filePath, game.features.whitelist.format);

  if (game.features.whitelist.format === 'json') {
    entries = entries.filter((e) => e.name !== entry && e.uuid !== entry);
  } else {
    entries = entries.filter((e) => e !== entry);
  }

  writeListFile(filePath, entries, game.features.whitelist.format);
  res.json({ message: 'Spieler von der Whitelist entfernt.', entries });
});

// ─── BANLIST ──────────────────────────────────────────────────────────────────

// GET /api/servers/:id/banlist
router.get('/banlist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });

  if (!game.features?.banlist?.supported) {
    return res.json({ supported: false, note: game.features?.banlist?.note || '' });
  }

  const filePath = path.join(server.dataPath, game.features.banlist.file);
  const entries = readListFile(filePath, game.features.banlist.format);
  res.json({ supported: true, entries, file: game.features.banlist.file, note: game.features.banlist.note });
});

// POST /api/servers/:id/banlist – Spieler bannen
router.post('/banlist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });
  if (!game.features?.banlist?.supported) return res.status(400).json({ error: 'Banlist nicht unterstützt.' });

  const { entry, reason } = req.body;
  if (!entry) return res.status(400).json({ error: 'Kein Eintrag angegeben.' });

  const filePath = path.join(server.dataPath, game.features.banlist.file);
  const entries = readListFile(filePath, game.features.banlist.format);

  const newEntry = game.features.banlist.format === 'json'
    ? { name: entry, uuid: '', reason: reason || 'Kein Grund angegeben', created: new Date().toISOString(), expires: 'forever' }
    : entry;

  entries.push(newEntry);
  writeListFile(filePath, entries, game.features.banlist.format);
  res.json({ message: 'Spieler gebannt.', entries });
});

// DELETE /api/servers/:id/banlist – Ban aufheben
router.delete('/banlist', requireAuth, async (req, res) => {
  const { server, game, error, status } = await loadServerAndGame(req.params.id, req.user.id);
  if (error) return res.status(status).json({ error });
  if (!game.features?.banlist?.supported) return res.status(400).json({ error: 'Banlist nicht unterstützt.' });

  const { entry } = req.body;
  const filePath = path.join(server.dataPath, game.features.banlist.file);
  let entries = readListFile(filePath, game.features.banlist.format);

  if (game.features.banlist.format === 'json') {
    entries = entries.filter((e) => e.name !== entry && e.uuid !== entry);
  } else {
    entries = entries.filter((e) => e !== entry);
  }

  writeListFile(filePath, entries, game.features.banlist.format);
  res.json({ message: 'Ban aufgehoben.', entries });
});

module.exports = router;
