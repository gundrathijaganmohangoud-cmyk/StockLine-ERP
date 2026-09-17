const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const controller = require('../controllers/enquiries.controller');

// POST /api/enquiries (SALES or ADMIN)
router.post('/', authMiddleware, requireRole('SALES', 'ADMIN'), asyncHandler(controller.create));

// GET /api/enquiries (any authenticated user), ?status= filter
router.get('/', authMiddleware, asyncHandler(controller.list));

// GET /api/enquiries/:id
router.get('/:id', authMiddleware, asyncHandler(controller.get));

module.exports = router;

