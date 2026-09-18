const express = require('express');
const cors = require('cors');
const errorMiddleware = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const enquiriesRoutes = require('./routes/enquiries.routes');
const quotationsRoutes = require('./routes/quotations.routes');
const salesOrdersRoutes = require('./routes/salesOrders.routes');
const dispatchesRoutes = require('./routes/dispatches.routes');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(function (origin) { return origin.trim(); })
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Public health check.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'stockflow-api',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/enquiries', enquiriesRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/sales-orders', salesOrdersRoutes);
app.use('/api/dispatches', dispatchesRoutes);

// 404 for unknown API routes.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Centralized error handler - always last.
app.use(errorMiddleware);

module.exports = app;

