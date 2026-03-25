const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const pidusage = require('pidusage');
const prisma = require('../lib/prisma');
const { getGameById } = require('./gameDefinitionService');

const STEAMCMD_DIR = process.env.STEAMCMD_PATH || path.join(__dirname, '../../../data/steamcmd');

// Laufende Prozesse im Speicher halten
const runningProcesses = new Map(); // serverId → ChildProcess
const statsIntervals = new Map();   // serverId → setInterval-ID

// Auto-Restart-Tracking
const manualStops = new Set();      // Server die manuell gestoppt wurden
const restartAttempts = new Map();  // serverId → { count, windowStart }
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 5 * 60 * 1000; // 5 Minuten

function buildSteamEnvironment(server, game) {
  const libraryPaths = [
    path.join(server.dataPath, 'game', 'bin', 'linuxsteamrt64'),
    path.join(server.dataPath, 'game', 'csgo', 'bin', 'linuxsteamrt64'),
    path.join(server.dataPath, 'game', 'csgo', 'bin'),
  ].filter((libraryPath) => fs.existsSync(libraryPath));

  const env = { ...process.env };
  if (process.env.LD_LIBRARY_PATH) {
    libraryPaths.push(process.env.LD_LIBRARY_PATH);
  }
  if (libraryPaths.length > 0) {
    env.LD_LIBRARY_PATH = libraryPaths.join(path.delimiter);
  }

  if (game.id === 'cs2') {
    env.SteamAppId = '730';
    env.SteamGameId = '730';
    env.HOME = env.HOME || os.homedir();
  }

  return env;
}

function ensureSteamSdkLinks(io, serverId) {
  const steamHome = process.env.HOME || os.homedir();
  if (!steamHome) return;

  const linkDefinitions = [
    {
      target: path.join(STEAMCMD_DIR, 'linux64', 'steamclient.so'),
      link: path.join(steamHome, '.steam', 'sdk64', 'steamclient.so'),
    },
    {
      target: path.join(STEAMCMD_DIR, 'linux32', 'steamclient.so'),
      link: path.join(steamHome, '.steam', 'sdk32', 'steamclient.so'),
    },
  ];

  for (const { target, link } of linkDefinitions) {
    if (!fs.existsSync(target) || fs.existsSync(link)) {
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(target, link);
      emitLog(io, serverId, `[GameStack] Steam Runtime vorbereitet: ${link} -> ${target}\n`);
    } catch (error) {
      emitLog(io, serverId, `[GameStack] Hinweis: Steam-Link konnte nicht erstellt werden (${error.message})\n`);
    }
  }
}

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
    const steamEnv = buildSteamEnvironment(server, game);
    const cs2ScriptPath = path.join(dataPath, 'game', 'cs2.sh');
    const hasCs2Script = fs.existsSync(cs2ScriptPath);

    // CS2 Spielmodus → game_type + game_mode Parameter
    const CS2_MODES = {
      competitive: { type: 0, mode: 1 },
      casual:      { type: 0, mode: 0 },
      deathmatch:  { type: 1, mode: 2 },
      wingman:     { type: 0, mode: 2 },
      arms_race:   { type: 1, mode: 0 },
      demolition:  { type: 1, mode: 1 },
    };
    const cs2Mode = CS2_MODES[config.gameMode] || CS2_MODES.competitive;

    // Startskript je nach Spiel
    const scripts = {
      valheim: { cmd: './valheim_server.x86_64', args: ['-name', config.worldName || 'MyWorld', '-port', String(server.port), '-world', config.worldName || 'MyWorld', '-password', config.serverPassword || ''], env: steamEnv },
      cs2: { cmd: hasCs2Script ? './cs2.sh' : './game/bin/linuxsteamrt64/cs2', args: [
        '-dedicated',
        '-port', String(server.port),
        '+game_type', String(cs2Mode.type),
        '+game_mode', String(cs2Mode.mode),
        '+map', config.mapName || 'de_dust2',
      ], cwd: hasCs2Script ? path.join(dataPath, 'game') : dataPath, env: steamEnv },
      palworld: { cmd: './PalServer.sh', args: [], env: steamEnv },
    };
    const script = scripts[game.id] || { cmd: './start.sh', args: [] };
    return { cmd: script.cmd, args: script.args, cwd: script.cwd || dataPath, env: script.env || steamEnv };
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
  if (game.type === 'steamcmd') {
    ensureSteamSdkLinks(io, serverId);
  }

  // Status auf "starting" setzen
  await prisma.server.update({ where: { id: serverId }, data: { status: 'starting' } });
  emitStatus(io, serverId, 'starting');

  const proc = spawn(command.cmd, command.args, {
    cwd: command.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    env: command.env || process.env,
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

    const wasManual = manualStops.has(serverId);
    manualStops.delete(serverId);

    // Auto-Restart prüfen: nur bei unerwartetem Absturz (code !== 0)
    if (!wasManual && code !== 0) {
      const serverData = await prisma.server.findUnique({ where: { id: serverId } });
      if (serverData?.autoRestart) {
        const now = Date.now();
        const attempts = restartAttempts.get(serverId) || { count: 0, windowStart: now };

        if (now - attempts.windowStart > RESTART_WINDOW_MS) {
          attempts.count = 0;
          attempts.windowStart = now;
        }

        if (attempts.count < MAX_RESTARTS) {
          attempts.count++;
          restartAttempts.set(serverId, attempts);

          emitLog(io, serverId, `\n[GameStack] ⚠ Server abgestürzt (Exit-Code: ${code}) – Neustart in 10 Sekunden... (Versuch ${attempts.count}/${MAX_RESTARTS})\n`);
          await prisma.server.update({ where: { id: serverId }, data: { status: 'stopped', pid: null } });
          emitStatus(io, serverId, 'stopped');

          setTimeout(async () => {
            try {
              emitLog(io, serverId, '[GameStack] Auto-Restart wird ausgeführt...\n');
              await startServer(serverId, io);
            } catch (err) {
              emitLog(io, serverId, `[GameStack] Auto-Restart fehlgeschlagen: ${err.message}\n`);
            }
          }, 10000);
          return;
        } else {
          restartAttempts.delete(serverId);
          emitLog(io, serverId, `\n[GameStack] ✗ Maximale Restart-Versuche (${MAX_RESTARTS}) innerhalb von 5 Minuten erreicht. Bitte manuell prüfen.\n`);
        }
      }
    }

    await prisma.server.update({ where: { id: serverId }, data: { status: 'stopped', pid: null } });
    emitStatus(io, serverId, 'stopped');
    const msg = code === 0 ? 'Server gestoppt.' : `Server gestoppt (Exit-Code: ${code})`;
    emitLog(io, serverId, `\n[GameStack] ${msg}\n`);
  });

  proc.on('error', async (err) => {
    stopStatsPolling(serverId);
    runningProcesses.delete(serverId);
    manualStops.delete(serverId);
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

  manualStops.add(serverId); // Als manuellen Stop markieren → kein Auto-Restart
  restartAttempts.delete(serverId); // Restart-Zähler zurücksetzen

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

module.exports = { startServer, stopServer, restartServer, sendCommand, runningProcesses, manualStops };
