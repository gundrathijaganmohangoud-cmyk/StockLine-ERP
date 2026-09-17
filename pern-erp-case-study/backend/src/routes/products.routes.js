const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const authMiddleware = require('../middleware/auth.middleware');
const productsController = require('../controllers/products.controller');

// GET /api/products (any authenticated user) - catalog for dropdowns.
router.get('/', authMiddleware, asyncHandler(productsController.listProducts));

module.exports = router;

