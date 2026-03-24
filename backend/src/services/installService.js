const { spawn } = require('child_process');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { getGameById } = require('./gameDefinitionService');

const STEAMCMD_DIR = process.env.STEAMCMD_PATH || path.join(__dirname, '../../../data/steamcmd');

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function emitLog(io, serverId, line) {
  if (io) io.to(`server:${serverId}`).emit('server:log', { serverId, line });
}

function emitInstallStatus(io, serverId, status) {
  if (io) io.to(`server:${serverId}`).emit('server:install-status', { serverId, status });
}

// ── SteamCMD sicherstellen ────────────────────────────────────────────────────

async function ensureSteamCmd(io, serverId) {
  const steamcmdExe = path.join(STEAMCMD_DIR, 'steamcmd.sh');
  if (fs.existsSync(steamcmdExe)) return steamcmdExe;

  emitLog(io, serverId, '[GameStack] SteamCMD wird heruntergeladen...\n');
  fs.mkdirSync(STEAMCMD_DIR, { recursive: true });

  // Tarball via fetch herunterladen (kein curl nötig)
  const tarPath = path.join(STEAMCMD_DIR, 'steamcmd_linux.tar.gz');
  await downloadFile(
    'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz',
    tarPath,
    io,
    serverId,
  );

  // Entpacken mit tar
  await new Promise((resolve, reject) => {
    const proc = spawn('tar', ['-xzf', tarPath, '-C', STEAMCMD_DIR]);
    proc.stderr.on('data', (d) => emitLog(io, serverId, d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('SteamCMD-Entpacken fehlgeschlagen.'));
    });
    proc.on('error', reject);
  });

  // Tarball aufräumen und Ausführrechte setzen
  fs.unlinkSync(tarPath);
  fs.chmodSync(steamcmdExe, '755');
  emitLog(io, serverId, '[GameStack] SteamCMD bereit.\n');
  return steamcmdExe;
}

// ── Datei via fetch herunterladen (kein curl nötig) ───────────────────────────

async function downloadFile(url, destPath, io, serverId) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} beim Download`);

  const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;
  let lastPercent = 0;

  const fileStream = fs.createWriteStream(destPath);
  const readable = Readable.fromWeb(res.body);

  return new Promise((resolve, reject) => {
    readable.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);
        if (percent >= lastPercent + 10) {
          lastPercent = percent;
          const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
          const total = (totalBytes / 1024 / 1024).toFixed(1);
          emitLog(io, serverId, `[GameStack] Fortschritt: ${percent}% (${mb} / ${total} MB)\n`);
        }
      }
    });
    readable.on('error', reject);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
    readable.pipe(fileStream);
  });
}

// ── Minecraft (Vanilla) installieren ─────────────────────────────────────────

async function installVanillaLatest(server, io) {
  emitLog(io, server.id, '[GameStack] Verbinde mit Mojang-API...\n');

  // 1. Versions-Manifest abrufen
  const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  if (!manifestRes.ok) throw new Error('Mojang-API nicht erreichbar');
  const manifest = await manifestRes.json();

  // 2. Neueste Release-Version ermitteln
  const latestVersion = manifest.latest.release;
  emitLog(io, server.id, `[GameStack] Neueste Minecraft-Version: ${latestVersion}\n`);

  // 3. Versions-spezifische JSON-URL finden
  const versionEntry = manifest.versions.find((v) => v.id === latestVersion);
  if (!versionEntry) throw new Error(`Version ${latestVersion} nicht im Manifest gefunden`);

  // 4. Server-Download-URL aus den Versions-Details holen
  const versionRes = await fetch(versionEntry.url);
  if (!versionRes.ok) throw new Error('Versions-Details nicht abrufbar');
  const versionData = await versionRes.json();

  const serverDownloadUrl = versionData.downloads?.server?.url;
  if (!serverDownloadUrl) throw new Error('Kein Server-Download für diese Version verfügbar');

  // 5. Server-JAR herunterladen
  const jarPath = path.join(server.dataPath, 'server.jar');
  emitLog(io, server.id, `[GameStack] Lade Vanilla Minecraft ${latestVersion} herunter...\n`);

  await downloadFile(serverDownloadUrl, jarPath, io, server.id);
  fs.writeFileSync(path.join(server.dataPath, 'eula.txt'), 'eula=true\n');
  emitLog(io, server.id, `[GameStack] Vanilla Minecraft ${latestVersion} installiert!\n`);
  emitLog(io, server.id, '[GameStack] EULA automatisch akzeptiert.\n');
}

// ── Minecraft (Paper) installieren ───────────────────────────────────────────

async function installPaper(server, config, io) {
  let version = config.minecraftVersion || 'latest';

  // "vanilla-latest" → Vanilla-Server direkt von Mojang herunterladen
  if (version === 'vanilla-latest') {
    return await installVanillaLatest(server, io);
  }

  // "latest" → neueste stabile Version von der Paper API ermitteln
  if (version === 'latest') {
    emitLog(io, server.id, '[GameStack] Ermittle neueste Minecraft-Version...\n');
    const projectRes = await fetch('https://api.papermc.io/v2/projects/paper');
    if (!projectRes.ok) throw new Error('Paper API nicht erreichbar');
    const projectData = await projectRes.json();
    version = projectData.versions[projectData.versions.length - 1];
    emitLog(io, server.id, `[GameStack] Neueste Version: ${version}\n`);
  }

  emitLog(io, server.id, `[GameStack] Verbinde mit Paper-API für Version ${version}...\n`);

  // Neuesten Build von der Paper API holen
  const apiBase = `https://api.papermc.io/v2/projects/paper/versions/${version}`;
  const apiRes = await fetch(apiBase);
  if (!apiRes.ok) {
    throw new Error(`Minecraft-Version "${version}" nicht gefunden. Verfügbare Versionen: https://papermc.io/downloads`);
  }

  const apiData = await apiRes.json();
  const latestBuild = apiData.builds[apiData.builds.length - 1];
  const jarName = `paper-${version}-${latestBuild}.jar`;
  const downloadUrl = `${apiBase}/builds/${latestBuild}/downloads/${jarName}`;
  const jarPath = path.join(server.dataPath, 'server.jar');

  emitLog(io, server.id, `[GameStack] Lade Paper ${version} (Build ${latestBuild}) herunter...\n`);

  await downloadFile(downloadUrl, jarPath, io, server.id);
  fs.writeFileSync(path.join(server.dataPath, 'eula.txt'), 'eula=true\n');
  emitLog(io, server.id, `[GameStack] Paper ${version} (Build ${latestBuild}) installiert!\n`);
  emitLog(io, server.id, '[GameStack] EULA automatisch akzeptiert.\n');
}

// ── SteamCMD-Spiel installieren / aktualisieren ───────────────────────────────

async function installSteamGame(server, game, io) {
  const steamcmdExe = await ensureSteamCmd(io, server.id);

  emitLog(io, server.id, `[GameStack] Installiere ${game.name} (AppID: ${game.steamAppId})...\n`);
  emitLog(io, server.id, '[GameStack] Dies kann je nach Internetgeschwindigkeit 5-30 Minuten dauern.\n');

  return new Promise((resolve, reject) => {
    const proc = spawn(steamcmdExe, [
      '+force_install_dir', server.dataPath,
      '+login', 'anonymous',
      '+app_update', String(game.steamAppId), 'validate',
      '+quit',
    ]);

    proc.stdout.on('data', (d) => emitLog(io, server.id, d.toString()));
    proc.stderr.on('data', (d) => emitLog(io, server.id, d.toString()));

    proc.on('close', (code) => {
      // SteamCMD Exit-Code 7 = Erfolg mit verfügbarem Update (ebenfalls OK)
      if (code === 0 || code === 7) {
        emitLog(io, server.id, `\n[GameStack] ${game.name} erfolgreich installiert!\n`);
        resolve();
      } else {
        reject(new Error(`SteamCMD beendet mit Exit-Code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

// ── Öffentliche Funktionen ────────────────────────────────────────────────────

async function installServer(serverId, io) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');

  const game = getGameById(server.gameType);
  if (!game) throw new Error('Game-Definition nicht gefunden.');

  fs.mkdirSync(server.dataPath, { recursive: true });

  await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'installing' } });
  emitInstallStatus(io, serverId, 'installing');

  const config = JSON.parse(server.config || '{}');

  try {
    emitLog(io, serverId, `\n[GameStack] ── Installation gestartet: ${game.name} ──\n`);

    if (game.type === 'java') {
      await installPaper(server, config, io);
    } else if (game.type === 'steamcmd') {
      await installSteamGame(server, game, io);
    } else {
      throw new Error(`Unbekannter Server-Typ: ${game.type}`);
    }

    await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'installed' } });
    emitInstallStatus(io, serverId, 'installed');
    emitLog(io, serverId, '[GameStack] ✓ Installation abgeschlossen! Server kann jetzt gestartet werden.\n');

  } catch (err) {
    await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'failed' } });
    emitInstallStatus(io, serverId, 'failed');
    emitLog(io, serverId, `[GameStack] ✗ Installation fehlgeschlagen: ${err.message}\n`);
  }
}

async function updateServer(serverId, io) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');
  if (server.status === 'running') throw new Error('Server muss zuerst gestoppt werden.');

  const game = getGameById(server.gameType);
  if (!game) throw new Error('Game-Definition nicht gefunden.');

  await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'installing' } });
  emitInstallStatus(io, serverId, 'installing');

  const config = JSON.parse(server.config || '{}');

  try {
    emitLog(io, serverId, `\n[GameStack] ── Update gestartet: ${game.name} ──\n`);

    if (game.type === 'java') {
      await installPaper(server, config, io);
    } else if (game.type === 'steamcmd') {
      await installSteamGame(server, game, io);
    }

    await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'installed' } });
    emitInstallStatus(io, serverId, 'installed');
    emitLog(io, serverId, '[GameStack] ✓ Update abgeschlossen!\n');

  } catch (err) {
    await prisma.server.update({ where: { id: serverId }, data: { installStatus: 'failed' } });
    emitInstallStatus(io, serverId, 'failed');
    emitLog(io, serverId, `[GameStack] ✗ Update fehlgeschlagen: ${err.message}\n`);
  }
}

module.exports = { installServer, updateServer };
