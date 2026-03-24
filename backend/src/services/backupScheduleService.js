const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { createBackup, listBackups, deleteBackup } = require('./backupService');

// Aktive Cron-Jobs im Speicher
const activeJobs = new Map(); // serverId → cron.Task

// Cron-Ausdruck aus einfachen Optionen bauen
function buildCronExpr(interval, hour = 3, weekday = 1) {
  switch (interval) {
    case 'hourly':    return '0 * * * *';
    case 'every6h':   return '0 */6 * * *';
    case 'every12h':  return '0 */12 * * *';
    case 'daily':     return `0 ${hour} * * *`;
    case 'weekly':    return `0 ${hour} * * ${weekday}`;
    default:          return `0 ${hour} * * *`;
  }
}

// Lesbarer Text für den Zeitplan
function describeSchedule(interval, hour, weekday) {
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  switch (interval) {
    case 'hourly':   return 'Jede Stunde';
    case 'every6h':  return 'Alle 6 Stunden';
    case 'every12h': return 'Alle 12 Stunden';
    case 'daily':    return `Täglich um ${String(hour).padStart(2,'0')}:00 Uhr`;
    case 'weekly':   return `Jeden ${days[weekday]} um ${String(hour).padStart(2,'0')}:00 Uhr`;
    default:         return 'Unbekannt';
  }
}

// Einen Job für einen Server starten
async function startJob(serverId) {
  // Alten Job stoppen falls vorhanden
  stopJob(serverId);

  const schedule = await prisma.backupSchedule.findUnique({ where: { serverId } });
  if (!schedule || !schedule.enabled) return;

  const job = cron.schedule(schedule.cronExpr, async () => {
    console.log(`[Backup-Scheduler] Automatisches Backup für Server ${serverId}…`);
    try {
      // Backup erstellen
      await createBackup(serverId, true);

      // Alte Backups aufräumen (keepCount einhalten)
      const backups = await listBackups(serverId);
      const autoBackups = backups.filter((b) => b.automatic && b.exists);
      if (autoBackups.length > schedule.keepCount) {
        const toDelete = autoBackups.slice(schedule.keepCount);
        for (const b of toDelete) {
          await deleteBackup(serverId, b.id);
          console.log(`[Backup-Scheduler] Altes Backup gelöscht: ${b.filename}`);
        }
      }
    } catch (err) {
      console.error(`[Backup-Scheduler] Fehler bei Server ${serverId}:`, err.message);
    }
  });

  activeJobs.set(serverId, job);
  console.log(`[Backup-Scheduler] Job gestartet für Server ${serverId}: ${schedule.cronExpr}`);
}

// Einen Job stoppen
function stopJob(serverId) {
  const job = activeJobs.get(serverId);
  if (job) {
    job.stop();
    activeJobs.delete(serverId);
    console.log(`[Backup-Scheduler] Job gestoppt für Server ${serverId}`);
  }
}

// Alle gespeicherten Zeitpläne beim App-Start laden
async function initAllSchedules() {
  const schedules = await prisma.backupSchedule.findMany({ where: { enabled: true } });
  for (const s of schedules) {
    await startJob(s.serverId);
  }
  console.log(`[Backup-Scheduler] ${schedules.length} Zeitplan(e) geladen.`);
}

module.exports = { startJob, stopJob, initAllSchedules, buildCronExpr, describeSchedule };
