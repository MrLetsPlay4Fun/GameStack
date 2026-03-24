const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');

const BACKUPS_BASE_PATH = process.env.BACKUPS_PATH || path.join(__dirname, '../../data/backups');

// Backup-Ordner für einen Server sicherstellen
function getBackupDir(serverId) {
  const dir = path.join(BACKUPS_BASE_PATH, String(serverId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Dateigröße in Bytes ermitteln
function getFileSize(filePath) {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

// Zeitstempel für Dateinamen
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ─── Backup erstellen ─────────────────────────────────────────────────────
async function createBackup(serverId, automatic = false) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');
  if (!fs.existsSync(server.dataPath)) throw new Error('Server-Datenordner existiert nicht.');

  const backupDir = getBackupDir(serverId);
  const filename = `backup_${timestamp()}.tar.gz`;
  const filePath = path.join(backupDir, filename);

  // tar-Befehl (funktioniert auf Linux; auf Windows nur mit WSL/Git-Bash)
  const cmd = `tar -czf "${filePath}" -C "${path.dirname(server.dataPath)}" "${path.basename(server.dataPath)}"`;

  await new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) reject(new Error(`Backup fehlgeschlagen: ${err.message}`));
      else resolve();
    });
  });

  const size = getFileSize(filePath);

  const backup = await prisma.backup.create({
    data: { serverId, filename, size, automatic },
  });

  console.log(`[Backup] Erstellt: ${filename} (${Math.round(size / 1024)} KB)`);
  return backup;
}

// ─── Backups auflisten ────────────────────────────────────────────────────
async function listBackups(serverId) {
  const backups = await prisma.backup.findMany({
    where: { serverId },
    orderBy: { createdAt: 'desc' },
  });

  // Prüfen ob Datei noch existiert
  const backupDir = getBackupDir(serverId);
  return backups.map((b) => ({
    ...b,
    exists: fs.existsSync(path.join(backupDir, b.filename)),
  }));
}

// ─── Backup wiederherstellen ──────────────────────────────────────────────
async function restoreBackup(serverId, backupId) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');
  if (server.status === 'running') throw new Error('Server muss zuerst gestoppt werden.');

  const backup = await prisma.backup.findFirst({ where: { id: backupId, serverId } });
  if (!backup) throw new Error('Backup nicht gefunden.');

  const backupDir = getBackupDir(serverId);
  const filePath = path.join(backupDir, backup.filename);
  if (!fs.existsSync(filePath)) throw new Error('Backup-Datei nicht gefunden.');

  // Alten Datenordner sichern (temporär umbenennen)
  const tempPath = server.dataPath + '_restore_temp_' + Date.now();
  if (fs.existsSync(server.dataPath)) {
    fs.renameSync(server.dataPath, tempPath);
  }

  try {
    // Datenordner neu anlegen und Backup entpacken
    fs.mkdirSync(path.dirname(server.dataPath), { recursive: true });
    const cmd = `tar -xzf "${filePath}" -C "${path.dirname(server.dataPath)}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err) => {
        if (err) reject(new Error(`Wiederherstellung fehlgeschlagen: ${err.message}`));
        else resolve();
      });
    });

    // Alten Temp-Ordner löschen
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }

    console.log(`[Backup] Wiederhergestellt: ${backup.filename}`);
    return { message: 'Backup erfolgreich wiederhergestellt.' };
  } catch (err) {
    // Rollback: Temp-Ordner zurückbenennen
    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, server.dataPath);
    }
    throw err;
  }
}

// ─── Backup löschen ───────────────────────────────────────────────────────
async function deleteBackup(serverId, backupId) {
  const backup = await prisma.backup.findFirst({ where: { id: backupId, serverId } });
  if (!backup) throw new Error('Backup nicht gefunden.');

  const backupDir = getBackupDir(serverId);
  const filePath = path.join(backupDir, backup.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await prisma.backup.delete({ where: { id: backupId } });
  return { message: 'Backup gelöscht.' };
}

module.exports = { createBackup, listBackups, restoreBackup, deleteBackup };
