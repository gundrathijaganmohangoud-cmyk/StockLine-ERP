const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const controller = require('../controllers/quotations.controller');

// POST /api/quotations (SALES or ADMIN) - server-authoritative pricing.
router.post('/', authMiddleware, requireRole('SALES', 'ADMIN'), asyncHandler(controller.create));

// GET /api/quotations (?status=)
router.get('/', authMiddleware, asyncHandler(controller.list));

// GET /api/quotations/:id
router.get('/:id', authMiddleware, asyncHandler(controller.get));

// PATCH /api/quotations/:id/status (SALES or ADMIN)
router.patch('/:id/status', authMiddleware, requireRole('SALES', 'ADMIN'), asyncHandler(controller.updateStatus));

// POST /api/quotations/:id/convert (SALES or ADMIN)
router.post('/:id/convert', authMiddleware, requireRole('SALES', 'ADMIN'), asyncHandler(controller.convert));

module.exports = router;

