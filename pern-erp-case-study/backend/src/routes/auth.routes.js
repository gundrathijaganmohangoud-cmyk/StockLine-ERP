const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/auth.controller');

// Public: POST /api/auth/login
router.post('/login', asyncHandler(authController.login));

module.exports = router;

