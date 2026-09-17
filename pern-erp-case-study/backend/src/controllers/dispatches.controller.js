const dispatchService = require('../services/dispatch.service');

// POST /api/sales-orders/:id/dispatch (ADMIN only)
exports.createForOrder = async function createForOrder(req, res) {
  const dispatch = await dispatchService.dispatchSalesOrder(req.params.id, req.body);
  return res.status(201).json(dispatch);
};

// GET /api/dispatches
exports.list = async function list(_req, res) {
  const dispatches = await dispatchService.listDispatches();
  return res.status(200).json(dispatches);
};

// GET /api/dispatches/:id
exports.get = async function get(req, res) {
  const dispatch = await dispatchService.getDispatchById(req.params.id);
  return res.status(200).json(dispatch);
};

