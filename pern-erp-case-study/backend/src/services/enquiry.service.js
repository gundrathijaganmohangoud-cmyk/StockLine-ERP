const prisma = require('../config/db');
const { httpError } = require('../utils/apiResponse');
const { parseDateInput } = require('../utils/dates');
const { nextDocumentNumber } = require('./numbering.service');

const ENQUIRY_STATUSES = ['NEW', 'QUOTED', 'WON', 'LOST'];

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, 'At least one item is required');
  }
  const items = [];
  const seen = new Set();
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i] || {};
    const productId = Number(raw.productId);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw httpError(400, 'items[' + i + '].productId must be a positive integer');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw httpError(400, 'items[' + i + '].quantity must be a positive integer');
    }
    if (seen.has(productId)) {
      throw httpError(400, 'Duplicate product ' + productId + ' in items (merge the lines instead)');
    }
    seen.add(productId);
    items.push({ productId: productId, quantity: quantity });
  }
  return items;
}

// Customer may be an existing id OR inline creation data.
// Returns the resolved customer id.
async function resolveCustomer(tx, body) {
  if (body.customerId !== undefined && body.customerId !== null && body.customerId !== '') {
    const customerId = Number(body.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      throw httpError(400, 'customerId must be a positive integer');
    }
    const existing = await tx.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw httpError(400, 'Customer ' + customerId + ' does not exist');
    return existing.id;
  }

  const c = body.customer || {};
  const companyName = String(c.companyName || '').trim();
  const contactPerson = String(c.contactPerson || '').trim();
  const mobile = String(c.mobile || '').trim();
  if (!companyName || !contactPerson || !mobile) {
    throw httpError(400, 'Provide an existing customerId, or companyName + contactPerson + mobile to create the customer inline');
  }
  const created = await tx.customer.create({
    data: {
      companyName: companyName,
      contactPerson: contactPerson,
      mobile: mobile,
      email: c.email ? String(c.email).trim() : null,
      city: c.city ? String(c.city).trim() : null,
    },
  });
  return created.id;
}

function enquiryDetailInclude() {
  return {
    customer: true,
    createdByUser: { select: { id: true, email: true, role: true } },
    items: {
      include: {
        product: { select: { id: true, productCode: true, productName: true, unit: true } },
      },
    },
  };
}

// Creates the enquiry and all its items in ONE Prisma transaction, with an
// atomically generated enquiry number (ENQ-0001, ENQ-0002, ...).
async function createEnquiry(user, body) {
  if (!user || !user.id) throw httpError(401, 'Authentication required');
  const payload = body || {};

  const items = normalizeItems(payload.items);
  const enquiryDate = parseDateInput(payload.enquiryDate, 'enquiryDate', false) || new Date();
  const requiredDate = parseDateInput(payload.requiredDate, 'requiredDate', false);
  const notes = payload.notes ? String(payload.notes).trim() : null;

  return prisma.$transaction(async function (tx) {
    const customerId = await resolveCustomer(tx, payload);

    const productIds = items.map(function (i) { return i.productId; });
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      const foundIds = products.map(function (p) { return p.id; });
      const missing = productIds.filter(function (id) { return foundIds.indexOf(id) === -1; });
      throw httpError(400, 'Unknown product id(s): ' + missing.join(', '));
    }

    const enquiryNumber = await nextDocumentNumber(tx, 'ENQ', 'ENQ');

    return tx.enquiry.create({
      data: {
        enquiryNumber: enquiryNumber,
        customerId: customerId,
        enquiryDate: enquiryDate,
        requiredDate: requiredDate,
        status: 'NEW',
        notes: notes,
        createdBy: user.id,
        items: { create: items },
      },
      include: enquiryDetailInclude(),
    });
  });
}

async function getEnquiryById(id) {
  const enquiryId = Number(id);
  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw httpError(400, 'Invalid enquiry id');
  }
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: enquiryDetailInclude(),
  });
  if (!enquiry) throw httpError(404, 'Enquiry not found');
  return enquiry;
}

async function listEnquiries(filters) {
  const where = {};
  const status = filters && filters.status;
  if (status) {
    if (ENQUIRY_STATUSES.indexOf(status) === -1) {
      throw httpError(400, 'Unknown status "' + status + '". Valid: ' + ENQUIRY_STATUSES.join(', '));
    }
    where.status = status;
  }

  const rows = await prisma.enquiry.findMany({
    where: where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { companyName: true } },
      _count: { select: { items: true } },
    },
  });

  return rows.map(function (e) {
    return {
      id: e.id,
      enquiryNumber: e.enquiryNumber,
      customerName: e.customer ? e.customer.companyName : null,
      enquiryDate: e.enquiryDate,
      requiredDate: e.requiredDate,
      status: e.status,
      itemCount: e._count.items,
      notes: e.notes,
      createdAt: e.createdAt,
    };
  });
}

module.exports = { createEnquiry, listEnquiries, getEnquiryById, ENQUIRY_STATUSES };

