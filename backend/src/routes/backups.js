const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { createBackup, listBackups, restoreBackup, deleteBackup } = require('../services/backupService');
const { startJob, stopJob, buildCronExpr, describeSchedule } = require('../services/backupScheduleService');
const prisma = require('../lib/prisma');

// Server-Zugehörigkeit prüfen
async function checkOwner(serverId, userId) {
  const server = await prisma.server.findFirst({ where: { id: Number(serverId), userId } });
  return server;
}

// GET /api/servers/:id/backups – alle Backups auflisten
router.get('/', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    const backups = await listBackups(server.id);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/backups – Backup erstellen
router.post('/', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    const backup = await createBackup(server.id, false);
    res.status(201).json(backup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/backups/:backupId/restore – Backup wiederherstellen
router.post('/:backupId/restore', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    const result = await restoreBackup(server.id, Number(req.params.backupId));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id/backups/:backupId – Backup löschen
router.delete('/:backupId', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });
    const result = await deleteBackup(server.id, Number(req.params.backupId));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:id/backups/schedule – Zeitplan laden
router.get('/schedule', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const schedule = await prisma.backupSchedule.findUnique({
      where: { serverId: server.id },
    });
    res.json(schedule || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/backups/schedule – Zeitplan speichern & aktivieren
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const { interval, hour = 3, weekday = 1, keepCount = 5, enabled = true } = req.body;
    if (!interval) return res.status(400).json({ error: 'Interval fehlt.' });

    const cronExpr = buildCronExpr(interval, Number(hour), Number(weekday));
    const description = describeSchedule(interval, Number(hour), Number(weekday));

    const schedule = await prisma.backupSchedule.upsert({
      where: { serverId: server.id },
      create: { serverId: server.id, cronExpr, keepCount: Number(keepCount), enabled },
      update: { cronExpr, keepCount: Number(keepCount), enabled },
    });

    // Cron-Job sofort starten oder stoppen
    if (enabled) {
      await startJob(server.id);
    } else {
      stopJob(server.id);
    }

    res.json({ ...schedule, description });
  } catch (err) {
    console.error('[Schedule] Fehler:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id/backups/schedule – Zeitplan löschen
router.delete('/schedule', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    stopJob(server.id);
    await prisma.backupSchedule.deleteMany({ where: { serverId: server.id } });
    res.json({ message: 'Zeitplan gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
