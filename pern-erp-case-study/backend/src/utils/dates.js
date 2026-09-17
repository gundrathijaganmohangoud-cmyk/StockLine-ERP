const { httpError } = require('./apiResponse');

// Parses a client-supplied date string into a Date.
// Empty/missing -> null (unless required -> 400). Invalid -> 400.
function parseDateInput(value, label, required) {
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, label + ' is required');
    return null;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw httpError(400, label + ' is not a valid date');
  return d;
}

module.exports = { parseDateInput };
