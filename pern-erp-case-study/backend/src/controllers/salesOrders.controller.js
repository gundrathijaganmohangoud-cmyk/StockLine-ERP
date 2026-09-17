const salesOrderService = require('../services/salesOrder.service');

// GET /api/sales-orders
exports.list = async function list(req, res) {
  const orders = await salesOrderService.listSalesOrders(req.query);
  return res.status(200).json(orders);
};

// GET /api/sales-orders/:id - includes live availability per line item.
exports.get = async function get(req, res) {
  const order = await salesOrderService.getSalesOrderById(req.params.id);
  return res.status(200).json(order);
};

// POST /api/sales-orders/:id/confirm (ADMIN only) - reserves inventory.
exports.confirm = async function confirm(req, res) {
  const order = await salesOrderService.confirmSalesOrder(req.params.id);
  return res.status(200).json(order);
};

