// Usage: router.post('/x', authMiddleware, requireRole('ADMIN'), handler)
// Returns 403 when the authenticated user's role is not in the allowed set.
module.exports = function requireRole() {
  const allowed = Array.prototype.slice.call(arguments);
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: this action requires role ' + allowed.join(' or ')
      });
    }
    return next();
  };
};

