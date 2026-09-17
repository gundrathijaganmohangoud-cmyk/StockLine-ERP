const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { httpError } = require('../utils/apiResponse');

const TOKEN_TTL = '8h';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly instead of signing tokens with a well-known default.
    throw httpError(500, 'Server misconfiguration: JWT_SECRET is not set');
  }
  return secret;
}

// Validates email/password against the users table and returns a signed JWT.
// The token payload carries { userId, role } and expires after 8 hours.
async function login(payload) {
  const email = String((payload && payload.email) || '').trim().toLowerCase();
  const password = String((payload && payload.password) || '');

  if (!email || !password) {
    throw httpError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email: email } });
  if (!user) {
    throw httpError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw httpError(401, 'Invalid email or password');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );

  return {
    token: token,
    expiresIn: TOKEN_TTL,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

module.exports = { login, getJwtSecret, TOKEN_TTL };

