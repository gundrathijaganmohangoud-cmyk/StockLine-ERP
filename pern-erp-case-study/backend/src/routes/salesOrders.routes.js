const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const controller = require('../controllers/salesOrders.controller');
const dispatchesController = require('../controllers/dispatches.controller');

// GET /api/sales-orders
router.get('/', authMiddleware, asyncHandler(controller.list));

// GET /api/sales-orders/:id (includes per-line inventory availability)
router.get('/:id', authMiddleware, asyncHandler(controller.get));

// POST /api/sales-orders/:id/confirm (ADMIN only) - reserves inventory.
router.post('/:id/confirm', authMiddleware, requireRole('ADMIN'), asyncHandler(controller.confirm));

// POST /api/sales-orders/:id/dispatch (ADMIN only)
router.post('/:id/dispatch', authMiddleware, requireRole('ADMIN'), asyncHandler(dispatchesController.createForOrder));

module.exports = router;

