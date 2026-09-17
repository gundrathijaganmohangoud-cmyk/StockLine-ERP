const quotationService = require('../services/quotation.service');

// POST /api/quotations (SALES or ADMIN) - server-authoritative pricing.
exports.create = async function create(req, res) {
  const quotation = await quotationService.createQuotation(req.user, req.body);
  return res.status(201).json(quotation);
};

// GET /api/quotations, supports ?status=
exports.list = async function list(req, res) {
  const quotations = await quotationService.listQuotations(req.query);
  return res.status(200).json(quotations);
};

// GET /api/quotations/:id - includes a freshly recalculated grand total.
exports.get = async function get(req, res) {
  const quotation = await quotationService.getQuotationById(req.params.id);
  return res.status(200).json(quotation);
};

// PATCH /api/quotations/:id/status (SALES or ADMIN)
exports.updateStatus = async function updateStatus(req, res) {
  const quotation = await quotationService.updateQuotationStatus(req.params.id, req.body && req.body.status);
  return res.status(200).json(quotation);
};

// POST /api/quotations/:id/convert (SALES or ADMIN)
exports.convert = async function convert(req, res) {
  const salesOrder = await quotationService.convertQuotationToOrder(req.params.id);
  return res.status(201).json(salesOrder);
};

