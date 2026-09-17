// Centralized error handling: every thrown/rejected error funnels here and
// leaves the API as { error: message } with an appropriate status code.

function errorMiddleware(err, _req, res, _next) {
  let status = Number(err.statusCode || err.status) || 500;
  let message = err.message || 'Internal server error';

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON payload';
  }

  // JWT problems that bubble up (normally handled in auth middleware)
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid or malformed token';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Session expired: please log in again';
  }

  // Prisma known error codes
  if (err.code === 'P2002') {
    status = 409;
    message = 'A record with this value already exists';
  }
  if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  }
  if (err.code === 'P2003') {
    status = 400;
    message = 'Related record does not exist (foreign key constraint)';
  }

  if (status >= 500) {
    console.error('[error]', status, err && (err.stack || err.message || err));
  }

  res.status(status).json({ error: message });
}

module.exports = errorMiddleware;

