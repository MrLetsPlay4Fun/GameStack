const fs = require('fs');
const path = require('path');

const DEFINITIONS_DIR = path.join(__dirname, '../gameDefinitions');

// Alle Game-Definitionen aus JSON-Dateien laden
function getAllGames() {
  const files = fs.readdirSync(DEFINITIONS_DIR).filter((f) => f.endsWith('.json'));
  return files.map((file) => {
    const content = fs.readFileSync(path.join(DEFINITIONS_DIR, file), 'utf-8');
    return JSON.parse(content);
  });
}

// Eine einzelne Game-Definition laden
function getGameById(id) {
  const filePath = path.join(DEFINITIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

module.exports = { getAllGames, getGameById };
