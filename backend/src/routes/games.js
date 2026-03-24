const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getAllGames, getGameById } = require('../services/gameDefinitionService');

// GET /api/games – alle verfügbaren Spiele
router.get('/', requireAuth, (req, res) => {
  try {
    const games = getAllGames();
    res.json(games);
  } catch (err) {
    console.error('[Games] Fehler beim Laden der Game-Definitionen:', err);
    res.status(500).json({ error: 'Spiele konnten nicht geladen werden.' });
  }
});

// GET /api/games/:id – ein einzelnes Spiel
router.get('/:id', requireAuth, (req, res) => {
  try {
    const game = getGameById(req.params.id);
    if (!game) return res.status(404).json({ error: 'Spiel nicht gefunden.' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: 'Spiel konnte nicht geladen werden.' });
  }
});

module.exports = router;
