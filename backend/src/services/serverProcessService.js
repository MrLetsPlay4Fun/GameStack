const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const pidusage = require('pidusage');
const prisma = require('../lib/prisma');
const { getGameById } = require('./gameDefinitionService');

// Laufende Prozesse im Speicher halten
const runningProcesses = new Map(); // serverId → ChildProcess
const statsIntervals = new Map();   // serverId → setInterval-ID

// Startbefehl je nach Spieltyp zusammenbauen
function buildStartCommand(server, game) {
  const dataPath = server.dataPath;
  const config = JSON.parse(server.config || '{}');

  if (game.type === 'java') {
    const memory = config.memory || 2048;
    return {
      cmd: 'java',
      args: [`-Xmx${memory}M`, `-Xms512M`, '-jar', 'server.jar', 'nogui'],
      cwd: dataPath,
    };
  }

  if (game.type === 'steamcmd') {
    // Startskript je nach Spiel
    const scripts = {
      valheim: { cmd: './valheim_server.x86_64', args: ['-name', config.worldName || 'MyWorld', '-port', String(server.port), '-world', config.worldName || 'MyWorld', '-password', config.serverPassword || ''] },
      cs2: { cmd: './game/bin/linuxsteamrt64/cs2', args: ['-dedicated', '-port', String(server.port), '+map', config.mapName || 'de_dust2'] },
      palworld: { cmd: './PalServer.sh', args: [] },
    };
    const script = scripts[game.id] || { cmd: './start.sh', args: [] };
    return { cmd: script.cmd, args: script.args, cwd: dataPath };
  }

  return null;
}

// Server starten
async function startServer(serverId, io) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');
  if (server.status === 'running') throw new Error('Server läuft bereits.');

  const game = getGameById(server.gameType);
  if (!game) throw new Error('Game-Definition nicht gefunden.');

  // Datenordner anlegen falls nicht vorhanden
  fs.mkdirSync(server.dataPath, { recursive: true });

  const command = buildStartCommand(server, game);
  if (!command) throw new Error('Kein Startbefehl für dieses Spiel definiert.');

  // Status auf "starting" setzen
  await prisma.server.update({ where: { id: serverId }, data: { status: 'starting' } });
  emitStatus(io, serverId, 'starting');

  const proc = spawn(command.cmd, command.args, {
    cwd: command.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  runningProcesses.set(serverId, proc);

  // PID + Status speichern
  await prisma.server.update({
    where: { id: serverId },
    data: { pid: proc.pid, status: 'running' },
  });
  emitStatus(io, serverId, 'running');

  // Ressourcen-Monitoring starten (alle 5 Sekunden)
  startStatsPolling(serverId, proc.pid, io);

  // Logs via Socket.io streamen
  proc.stdout.on('data', (data) => {
    emitLog(io, serverId, data.toString());
  });
  proc.stderr.on('data', (data) => {
    emitLog(io, serverId, data.toString());
  });

  // Prozess beendet
  proc.on('close', async (code) => {
    stopStatsPolling(serverId);
    runningProcesses.delete(serverId);
    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'stopped', pid: null },
    });
    emitStatus(io, serverId, 'stopped');
    emitLog(io, serverId, `\n[GameStack] Server gestoppt (Exit-Code: ${code})\n`);
  });

  proc.on('error', async (err) => {
    stopStatsPolling(serverId);
    runningProcesses.delete(serverId);
    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'stopped', pid: null },
    });
    emitStatus(io, serverId, 'stopped');
    emitLog(io, serverId, `\n[GameStack] Fehler: ${err.message}\n`);
  });

  return proc.pid;
}

// Server stoppen
async function stopServer(serverId, io) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new Error('Server nicht gefunden.');
  if (server.status === 'stopped') throw new Error('Server ist bereits gestoppt.');

  await prisma.server.update({ where: { id: serverId }, data: { status: 'stopping' } });
  emitStatus(io, serverId, 'stopping');

  const proc = runningProcesses.get(serverId);
  if (proc) {
    proc.kill('SIGTERM');
    // Nach 10 Sekunden force-kill
    setTimeout(() => {
      if (runningProcesses.has(serverId)) {
        proc.kill('SIGKILL');
      }
    }, 10000);
  } else {
    // Prozess nicht im Speicher (z.B. nach Neustart des Backends)
    await prisma.server.update({
      where: { id: serverId },
      data: { status: 'stopped', pid: null },
    });
    emitStatus(io, serverId, 'stopped');
  }
}

// Server neu starten
async function restartServer(serverId, io) {
  await stopServer(serverId, io);
  // Kurz warten bis der Prozess wirklich beendet ist
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await startServer(serverId, io);
}

// Befehl an Server-Konsole senden (stdin)
function sendCommand(serverId, command) {
  const proc = runningProcesses.get(serverId);
  if (!proc) throw new Error('Server läuft nicht.');
  proc.stdin.write(command + '\n');
}

// Ressourcen-Polling starten
function startStatsPolling(serverId, pid, io) {
  stopStatsPolling(serverId);
  const interval = setInterval(async () => {
    try {
      const stats = await pidusage(pid);
      if (io) {
        io.to(`server:${serverId}`).emit('server:stats', {
          serverId,
          cpu: Math.round(stats.cpu * 10) / 10,   // CPU in % (1 Dezimalstelle)
          ram: Math.round(stats.memory / 1024 / 1024), // RAM in MB
        });
      }
    } catch {
      stopStatsPolling(serverId); // Prozess existiert nicht mehr
    }
  }, 5000);
  statsIntervals.set(serverId, interval);
}

// Ressourcen-Polling stoppen
function stopStatsPolling(serverId) {
  const interval = statsIntervals.get(serverId);
  if (interval) {
    clearInterval(interval);
    statsIntervals.delete(serverId);
  }
}

// Hilfsfunktionen für Socket.io – emit nur in den Server-Raum
function emitStatus(io, serverId, status) {
  if (io) io.to(`server:${serverId}`).emit('server:status', { serverId, status });
}
function emitLog(io, serverId, line) {
  if (io) io.to(`server:${serverId}`).emit('server:log', { serverId, line });
}

module.exports = { startServer, stopServer, restartServer, sendCommand, runningProcesses };
