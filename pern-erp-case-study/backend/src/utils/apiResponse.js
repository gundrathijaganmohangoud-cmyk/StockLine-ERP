// Small helpers for consistent responses and errors.
// Every error response has the shape: { error: message }

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function httpError(statusCode, message) {
  return new HttpError(statusCode, message);
}

function ok(res, data, statusCode) {
  return res.status(statusCode || 200).json(data);
}

function fail(res, statusCode, message) {
  return res.status(statusCode).json({ error: message });
}

module.exports = { HttpError, httpError, ok, fail };

