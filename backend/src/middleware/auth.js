const jwt = require('jsonwebtoken');

// Middleware: Prüft ob ein gültiger JWT-Token mitgeschickt wurde
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Kein Token – bitte einloggen.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token ungültig oder abgelaufen.' });
  }
}

module.exports = { requireAuth };
