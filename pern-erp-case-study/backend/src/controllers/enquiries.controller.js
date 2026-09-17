const enquiryService = require('../services/enquiry.service');

// POST /api/enquiries (SALES or ADMIN)
exports.create = async function create(req, res) {
  const enquiry = await enquiryService.createEnquiry(req.user, req.body);
  return res.status(201).json(enquiry);
};

// GET /api/enquiries (any authenticated user), supports ?status=
exports.list = async function list(req, res) {
  const enquiries = await enquiryService.listEnquiries(req.query);
  return res.status(200).json(enquiries);
};

// GET /api/enquiries/:id
exports.get = async function get(req, res) {
  const enquiry = await enquiryService.getEnquiryById(req.params.id);
  return res.status(200).json(enquiry);
};

