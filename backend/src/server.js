require('dotenv').config();

// ── Sicherheits-Check: JWT_SECRET muss gesetzt und sicher sein ────────────────
const INSECURE_SECRETS = ['', 'change-this-secret-in-production', 'change-this-to-a-random-secret', 'gamestack-dev-secret-change-in-production'];
if (!process.env.JWT_SECRET || INSECURE_SECRETS.includes(process.env.JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FEHLER: JWT_SECRET ist nicht gesetzt oder unsicher!');
    console.error('   Generiere einen sicheren Schlüssel: openssl rand -hex 32');
    console.error('   Und trage ihn in die .env-Datei ein.');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNUNG: Unsicherer JWT_SECRET erkannt – nur für Entwicklung akzeptabel!');
  }
}

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const gamesRouter = require('./routes/games');
const serversRouter = require('./routes/servers');
const playerListsRouter = require('./routes/playerLists');
const backupsRouter = require('./routes/backups');
const { initAllSchedules } = require('./services/backupScheduleService');
const { initAllTasks } = require('./services/taskSchedulerService');
const tasksRouter = require('./routes/tasks');

const app = express();
const httpServer = createServer(app);

// Socket.io einrichten
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// io-Instanz an den Server-Router weitergeben
serversRouter.setIo(io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
app.use(express.json());

// Routen
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/servers', serversRouter);
app.use('/api/servers/:id', playerListsRouter);
app.use('/api/servers/:id/backups', backupsRouter);
app.use('/api/servers/:id/tasks', tasksRouter);

// Socket.io – Client-Verbindungen verwalten
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client verbunden: ${socket.id}`);

  // Client tritt einem Server-Raum bei (für gezielte Log-Streams)
  socket.on('join:server', (serverId) => {
    socket.join(`server:${serverId}`);
    console.log(`[Socket.io] Client ${socket.id} joined server:${serverId}`);
  });

  socket.on('leave:server', (serverId) => {
    socket.leave(`server:${serverId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client getrennt: ${socket.id}`);
  });
});

// Server starten
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  console.log(`✅ GameStack Backend läuft auf http://localhost:${PORT}`);
  console.log(`   Health-Check: http://localhost:${PORT}/api/health`);
  await initAllSchedules();
  await initAllTasks();
});
