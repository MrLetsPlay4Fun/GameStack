const express = require('express');
const router = express.Router();

// GET /api/health
// Prüft ob das Backend läuft
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'GameStack Backend läuft',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

module.exports = router;
