// Wraps an async route handler so rejections reach the error middleware
// instead of crashing the process (works on any Express version).
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
