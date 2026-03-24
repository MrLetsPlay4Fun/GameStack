const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');

// Rate-Limiter: max. 10 Versuche pro 15 Minuten pro IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Zu viele Anfragen – bitte in 15 Minuten erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/auth/setup ─────────────────────────────────────────────────────
// Erster Start: Admin-Account anlegen (nur wenn noch kein User existiert)
router.post('/setup', authLimiter, async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Setup bereits abgeschlossen.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
    }
    if (password.length < 12) {
      return res.status(400).json({ error: 'Passwort muss mindestens 12 Zeichen lang sein.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, passwordHash, role: 'admin' },
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('[Auth] Setup-Fehler:', err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich.' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('[Auth] Login-Fehler:', err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
// Prüft ob bereits ein User existiert (für Setup-Wizard im Frontend)
router.get('/status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ setupRequired: userCount === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

module.exports = router;
