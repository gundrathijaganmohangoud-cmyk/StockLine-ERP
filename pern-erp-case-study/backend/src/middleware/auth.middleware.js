const jwt = require('jsonwebtoken');

// Verifies the JWT from "Authorization: Bearer <token>" and attaches
// req.user = { id, role }. Returns 401 with a specific message for:
//   - missing/malformed Authorization header
//   - missing server secret (misconfiguration)
//   - malformed/expired/invalid-signature tokens
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required: send "Authorization: Bearer <token>" header'
    });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required: token is empty' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: 'Server misconfiguration: JWT_SECRET is not set'
    });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (!payload || typeof payload.userId !== 'number' || !payload.role) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.user = { id: payload.userId, role: payload.role };
    return next();
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired: please log in again' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token' });
  }
};

