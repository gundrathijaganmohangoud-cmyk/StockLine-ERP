const prisma = require('../config/db');
const { httpError } = require('../utils/apiResponse');
const { parseDateInput } = require('../utils/dates');
const { nextDocumentNumber } = require('./numbering.service');
const { calculateLineAmount, calculateGrandTotal } = require('../utils/calculations');

const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];

// State machine: DRAFT -> SENT; SENT -> ACCEPTED | REJECTED. Nothing else.
const ALLOWED_TRANSITIONS = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

function normalizeQuotationItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, 'At least one quotation item is required');
  }
  const items = [];
  const seen = new Set();
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i] || {};
    const productId = Number(raw.productId);
    const quantity = Number(raw.quantity);
    const unitPrice = raw.unitPrice === undefined || raw.unitPrice === null || raw.unitPrice === ''
      ? null : Number(raw.unitPrice);
    const discountPct = raw.discountPct === undefined || raw.discountPct === null || raw.discountPct === ''
      ? 0 : Number(raw.discountPct);
    const gstPct = raw.gstPct === undefined || raw.gstPct === null || raw.gstPct === ''
      ? 0 : Number(raw.gstPct);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw httpError(400, 'items[' + i + '].productId must be a positive integer');
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw httpError(400, 'items[' + i + '].quantity must be a positive integer');
    }
    if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw httpError(400, 'items[' + i + '].unitPrice must be a non-negative number');
    }
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
      throw httpError(400, 'items[' + i + '].discountPct must be between 0 and 100');
    }
    if (!Number.isFinite(gstPct) || gstPct < 0) {
      throw httpError(400, 'items[' + i + '].gstPct must be a non-negative number');
    }
    if (seen.has(productId)) {
      throw httpError(400, 'Duplicate product ' + productId + ' in items');
    }
    seen.add(productId);

    // SERVER-AUTHORITATIVE PRICING: lineAmount / grandTotal / total fields that
    // arrive in the request body are deliberately NEVER read here. The only
    // inputs are quantity, unitPrice, discountPct and gstPct.
    items.push({ productId: productId, quantity: quantity, unitPrice: unitPrice, discountPct: discountPct, gstPct: gstPct });
  }
  return items;
}

function quotationDetailInclude() {
  return {
    enquiry: { select: { id: true, enquiryNumber: true, status: true } },
    customer: true,
    createdByUser: { select: { id: true, email: true, role: true } },
    items: {
      include: {
        product: { select: { id: true, productCode: true, productName: true, unit: true } },
      },
    },
  };
}

// Creates a quotation from an enquiry. Line amounts and the grand total are
// ALWAYS recalculated server-side; client totals are ignored by design.
async function createQuotation(user, body) {
  if (!user || !user.id) throw httpError(401, 'Authentication required');
  const payload = body || {};

  const enquiryId = Number(payload.enquiryId);
  if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
    throw httpError(400, 'A valid enquiryId is required');
  }

  const items = normalizeQuotationItems(payload.items);
  const validUntil = parseDateInput(payload.validUntil, 'validUntil', false);

  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    include: { customer: true },
  });
  if (!enquiry) throw httpError(400, 'Enquiry ' + enquiryId + ' does not exist');
  if (enquiry.status === 'WON' || enquiry.status === 'LOST') {
    throw httpError(400, 'Enquiry ' + enquiryId + ' is ' + enquiry.status + ' and can no longer be quoted');
  }

  const productIds = items.map(function (i) { return i.productId; });
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    const foundIds = products.map(function (p) { return p.id; });
    const missing = productIds.filter(function (id) { return foundIds.indexOf(id) === -1; });
    throw httpError(400, 'Unknown product id(s): ' + missing.join(', '));
  }

  // The authoritative math happens here, in integer-cents-safe pure functions.
  const calculatedLines = items.map(function (item) {
    const line = calculateLineAmount(item);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPct: item.discountPct,
      gstPct: item.gstPct,
      lineAmount: line.lineAmount,
    };
  });
  const grandTotal = calculateGrandTotal(items);

  return prisma.$transaction(async function (tx) {
    const quotationNumber = await nextDocumentNumber(tx, 'QTN', 'QTN');

    const quotation = await tx.quotation.create({
      data: {
        quotationNumber: quotationNumber,
        enquiryId: enquiryId,
        customerId: enquiry.customerId,
        status: 'DRAFT',
        validUntil: validUntil,
        grandTotal: grandTotal,
        createdBy: user.id,
        items: { create: calculatedLines },
      },
      include: quotationDetailInclude(),
    });

    // Enquiry lifecycle: first quotation moves NEW -> QUOTED (idempotent).
    await tx.enquiry.update({ where: { id: enquiryId }, data: { status: 'QUOTED' } });

    return quotation;
  });
}

// PATCH /quotations/:id/status
// Allowed: DRAFT -> SENT, SENT -> ACCEPTED, SENT -> REJECTED. Everything else
// is rejected with 400 and a clear message. The updateMany-with-status-guard
// makes the transition atomic against concurrent status changes.
async function updateQuotationStatus(quotationId, nextStatus) {
  const id = Number(quotationId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid quotation id');
  if (QUOTATION_STATUSES.indexOf(nextStatus) === -1) {
    throw httpError(400, 'Unknown status "' + nextStatus + '". Valid: ' + QUOTATION_STATUSES.join(', '));
  }

  const quotation = await prisma.quotation.findUnique({ where: { id: id } });
  if (!quotation) throw httpError(404, 'Quotation not found');

  const allowed = ALLOWED_TRANSITIONS[quotation.status] || [];
  if (allowed.indexOf(nextStatus) === -1) {
    throw httpError(
      400,
      'Invalid status transition: ' + quotation.status + ' -> ' + nextStatus +
      '. Allowed from ' + quotation.status + ': ' + (allowed.length ? allowed.join(', ') : 'none')
    );
  }

  return prisma.$transaction(async function (tx) {
    // Atomic claim: only succeeds if the status is still what we validated.
    const claimed = await tx.quotation.updateMany({
      where: { id: id, status: quotation.status },
      data: { status: nextStatus },
    });
    if (claimed.count === 0) {
      throw httpError(409, 'Quotation status changed concurrently; reload and try again');
    }

    const updated = await tx.quotation.findUnique({
      where: { id: id },
      include: quotationDetailInclude(),
    });

    // Mirror the decision onto the enquiry lifecycle.
    if (nextStatus === 'ACCEPTED') {
      await tx.enquiry.update({ where: { id: updated.enquiryId }, data: { status: 'WON' } });
    } else if (nextStatus === 'REJECTED') {
      await tx.enquiry.update({ where: { id: updated.enquiryId }, data: { status: 'LOST' } });
    }

    return updated;
  });
}

async function listQuotations(filters) {
  const where = {};
  const status = filters && filters.status;
  if (status) {
    if (QUOTATION_STATUSES.indexOf(status) === -1) {
      throw httpError(400, 'Unknown status "' + status + '". Valid: ' + QUOTATION_STATUSES.join(', '));
    }
    where.status = status;
  }

  const rows = await prisma.quotation.findMany({
    where: where,
    orderBy: { createdAt: 'desc' },
    include: {
      enquiry: { select: { id: true, enquiryNumber: true, status: true } },
      customer: { select: { companyName: true } },
      _count: { select: { items: true } },
    },
  });

  return rows.map(function (q) {
    return {
      id: q.id,
      quotationNumber: q.quotationNumber,
      enquiry: q.enquiry,
      customerName: q.customer ? q.customer.companyName : null,
      status: q.status,
      grandTotal: q.grandTotal,
      validUntil: q.validUntil,
      itemCount: q._count.items,
      createdAt: q.createdAt,
    };
  });
}

async function getQuotationById(id) {
  const quotationId = Number(id);
  if (!Number.isInteger(quotationId) || quotationId <= 0) {
    throw httpError(400, 'Invalid quotation id');
  }
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: quotationDetailInclude(),
  });
  if (!quotation) throw httpError(404, 'Quotation not found');

  // Recalculated for verification: proves the stored grand_total against a
  // fresh computation of the stored line inputs.
  const recalculatedGrandTotal = calculateGrandTotal(quotation.items.map(function (i) {
    return {
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountPct: i.discountPct,
      gstPct: i.gstPct,
    };
  }));

  return Object.assign({}, quotation, { recalculatedGrandTotal: recalculatedGrandTotal });
}

// Quotation -> Sales Order conversion.
// - Only ACCEPTED quotations convert (400 otherwise).
// - Defense in depth #1: pre-transaction existence check -> friendly 409.
// - Defense in depth #2: re-check INSIDE the transaction.
// - Defense in depth #3 (the hard guarantee): sales_orders.quotation_id is
//   UNIQUE in the database. If two convert requests run simultaneously, the
//   loser's INSERT fails with Prisma P2002, which we translate into a clean
//   409 instead of crashing.
async function convertQuotationToOrder(quotationId) {
  const id = Number(quotationId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid quotation id');

  const quotation = await prisma.quotation.findUnique({
    where: { id: id },
    include: { items: true, customer: true },
  });
  if (!quotation) throw httpError(404, 'Quotation not found');

  if (quotation.status !== 'ACCEPTED') {
    throw httpError(400, 'Only ACCEPTED quotations can be converted (current status: ' + quotation.status + ')');
  }

  const preExisting = await prisma.salesOrder.findUnique({ where: { quotationId: id } });
  if (preExisting) {
    throw httpError(409, 'A sales order already exists for this quotation (' + preExisting.orderNumber + ')');
  }

  try {
    return await prisma.$transaction(async function (tx) {
      const duplicate = await tx.salesOrder.findUnique({ where: { quotationId: id } });
      if (duplicate) {
        throw httpError(409, 'A sales order already exists for this quotation (' + duplicate.orderNumber + ')');
      }

      const orderNumber = await nextDocumentNumber(tx, 'SO', 'SO');

      return tx.salesOrder.create({
        data: {
          orderNumber: orderNumber,
          quotationId: id,
          customerId: quotation.customerId,
          orderDate: new Date(),
          status: 'PENDING',
          // The quotation grand total was computed server-side at creation and
          // is now copied verbatim - never recomputed from client data.
          totalAmount: quotation.grandTotal,
          items: {
            create: quotation.items.map(function (item) {
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              };
            }),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, productCode: true, productName: true, unit: true } } } },
          customer: true,
          quotation: { select: { id: true, quotationNumber: true, grandTotal: true } },
        },
      });
    });
  } catch (err) {
    if (err && err.code === 'P2002') {
      // Lost a race against a concurrent conversion of the same quotation.
      throw httpError(409, 'A sales order already exists for this quotation (concurrent conversion blocked by the database)');
    }
    throw err;
  }
}

module.exports = {
  createQuotation,
  updateQuotationStatus,
  listQuotations,
  getQuotationById,
  convertQuotationToOrder,
  QUOTATION_STATUSES,
};



