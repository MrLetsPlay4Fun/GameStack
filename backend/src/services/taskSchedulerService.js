const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { sendCommand, runningProcesses } = require('./serverProcessService');

// Aktive Task-Jobs im Speicher
const activeTaskJobs = new Map(); // taskId → cron.Task

// Intervall-Optionen (gleiche Logik wie Backup-Scheduler)
function buildCronExpr(interval, hour = 0, minute = 0, weekday = 1) {
  switch (interval) {
    case 'every5m':   return '*/5 * * * *';
    case 'every10m':  return '*/10 * * * *';
    case 'every15m':  return '*/15 * * * *';
    case 'every30m':  return '*/30 * * * *';
    case 'every60m':  return '0 * * * *';
    case 'every2h':   return '0 */2 * * *';
    case 'every6h':   return '0 */6 * * *';
    case 'every12h':  return '0 */12 * * *';
    case 'daily':     return `${minute} ${hour} * * *`;
    case 'weekly':    return `${minute} ${hour} * * ${weekday}`;
    default:          return '0 * * * *';
  }
}

function describeInterval(interval, hour, minute, weekday) {
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const t = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} Uhr`;
  switch (interval) {
    case 'every5m':  return 'Alle 5 Minuten';
    case 'every10m': return 'Alle 10 Minuten';
    case 'every15m': return 'Alle 15 Minuten';
    case 'every30m': return 'Alle 30 Minuten';
    case 'every60m': return 'Jede Stunde';
    case 'every2h':  return 'Alle 2 Stunden';
    case 'every6h':  return 'Alle 6 Stunden';
    case 'every12h': return 'Alle 12 Stunden';
    case 'daily':    return `Täglich um ${t}`;
    case 'weekly':   return `Jeden ${days[weekday]} um ${t}`;
    default:         return interval;
  }
}

// Einen Task-Job starten
async function startTaskJob(taskId) {
  stopTaskJob(taskId);

  const task = await prisma.scheduledTask.findUnique({ where: { id: taskId } });
  if (!task || !task.enabled) return;

  const commands = JSON.parse(task.commands || '[]');
  if (commands.length === 0) return;

  const job = cron.schedule(task.cronExpr, async () => {
    const isRunning = runningProcesses.has(task.serverId);
    if (!isRunning) {
      console.log(`[TaskScheduler] Server ${task.serverId} läuft nicht – Task "${task.name}" übersprungen.`);
      return;
    }

    console.log(`[TaskScheduler] Führe Task "${task.name}" auf Server ${task.serverId} aus...`);
    for (const cmd of commands) {
      try {
        sendCommand(task.serverId, cmd);
        console.log(`[TaskScheduler]   → ${cmd}`);
        // Kurze Pause zwischen Befehlen (500ms)
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`[TaskScheduler] Fehler bei Befehl "${cmd}":`, err.message);
      }
    }

    // Letzten Ausführungszeitpunkt speichern
    await prisma.scheduledTask.update({
      where: { id: taskId },
      data: { lastRun: new Date() },
    });
  });

  activeTaskJobs.set(taskId, job);
  console.log(`[TaskScheduler] Job gestartet: "${task.name}" (${task.cronExpr})`);
}

// Task-Job stoppen
function stopTaskJob(taskId) {
  const job = activeTaskJobs.get(taskId);
  if (job) {
    job.stop();
    activeTaskJobs.delete(taskId);
  }
}

// Alle Tasks beim App-Start laden
async function initAllTasks() {
  const tasks = await prisma.scheduledTask.findMany({ where: { enabled: true } });
  for (const task of tasks) {
    await startTaskJob(task.id);
  }
  console.log(`[TaskScheduler] ${tasks.length} Aufgabe(n) geladen.`);
}

module.exports = { startTaskJob, stopTaskJob, initAllTasks, buildCronExpr, describeInterval };
