const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { startTaskJob, stopTaskJob, buildCronExpr, describeInterval } = require('../services/taskSchedulerService');

// Server-Zugehörigkeit prüfen
async function checkOwner(serverId, userId) {
  return prisma.server.findFirst({ where: { id: Number(serverId), userId } });
}

// GET /api/servers/:id/tasks
router.get('/', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const tasks = await prisma.scheduledTask.findMany({
      where: { serverId: server.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/tasks – neue Aufgabe erstellen
router.post('/', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const { name, interval, hour = 0, minute = 0, weekday = 1, commands = [], enabled = true } = req.body;
    if (!name) return res.status(400).json({ error: 'Name fehlt.' });
    if (!commands.length) return res.status(400).json({ error: 'Mindestens ein Befehl erforderlich.' });

    const cronExpr = buildCronExpr(interval, Number(hour), Number(minute), Number(weekday));

    const task = await prisma.scheduledTask.create({
      data: {
        serverId: server.id,
        name,
        cronExpr,
        commands: JSON.stringify(commands),
        enabled,
      },
    });

    if (enabled) await startTaskJob(task.id);

    res.status(201).json({ ...task, description: describeInterval(interval, hour, minute, weekday) });
  } catch (err) {
    console.error('[Tasks] Erstellen fehlgeschlagen:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/servers/:id/tasks/:taskId – Aufgabe bearbeiten
router.patch('/:taskId', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const existing = await prisma.scheduledTask.findFirst({
      where: { id: Number(req.params.taskId), serverId: server.id },
    });
    if (!existing) return res.status(404).json({ error: 'Aufgabe nicht gefunden.' });

    const { name, interval, hour = 0, minute = 0, weekday = 1, commands, enabled } = req.body;
    const cronExpr = interval ? buildCronExpr(interval, Number(hour), Number(minute), Number(weekday)) : existing.cronExpr;

    const updated = await prisma.scheduledTask.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined && { name }),
        ...(interval !== undefined && { cronExpr }),
        ...(commands !== undefined && { commands: JSON.stringify(commands) }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    // Job neu starten oder stoppen
    stopTaskJob(existing.id);
    if (updated.enabled) await startTaskJob(updated.id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id/tasks/:taskId
router.delete('/:taskId', requireAuth, async (req, res) => {
  try {
    const server = await checkOwner(req.params.id, req.user.id);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    const task = await prisma.scheduledTask.findFirst({
      where: { id: Number(req.params.taskId), serverId: server.id },
    });
    if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden.' });

    stopTaskJob(task.id);
    await prisma.scheduledTask.delete({ where: { id: task.id } });
    res.json({ message: 'Aufgabe gelöscht.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
