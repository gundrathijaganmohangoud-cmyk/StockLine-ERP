const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth.middleware');
const controller = require('../controllers/dispatches.controller');

// GET /api/dispatches
router.get('/', authMiddleware, asyncHandler(controller.list));

// GET /api/dispatches/:id
router.get('/:id', authMiddleware, asyncHandler(controller.get));

module.exports = router;

