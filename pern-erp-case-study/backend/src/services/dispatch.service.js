const prisma = require('../config/db');
const { httpError } = require('../utils/apiResponse');
const { nextDocumentNumber } = require('./numbering.service');
const inventoryService = require('./inventory.service');

const DISPATCH_INCLUDE = {
  salesOrder: { select: { id: true, orderNumber: true, status: true } },
  items: {
    include: {
      product: { select: { id: true, productCode: true, productName: true, unit: true } },
    },
  },
};

async function listDispatches() {
  const rows = await prisma.dispatch.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      salesOrder: { select: { id: true, orderNumber: true, status: true } },
      _count: { select: { items: true } },
    },
  });
  return rows.map(function (d) {
    return {
      id: d.id,
      dispatchNumber: d.dispatchNumber,
      salesOrder: d.salesOrder,
      dispatchDate: d.dispatchDate,
      vehicleNumber: d.vehicleNumber,
      driverName: d.driverName,
      itemCount: d._count.items,
      createdAt: d.createdAt,
    };
  });
}

async function getDispatchById(id) {
  const dispatchId = Number(id);
  if (!Number.isInteger(dispatchId) || dispatchId <= 0) {
    throw httpError(400, 'Invalid dispatch id');
  }
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: DISPATCH_INCLUDE,
  });
  if (!dispatch) throw httpError(404, 'Dispatch not found');
  return dispatch;
}

// Validates items against the order lines and merges duplicates per product.
function normalizeDispatchItems(rawItems, orderItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError(400, 'At least one dispatch item is required');
  }
  const orderQtyByProduct = new Map();
  orderItems.forEach(function (i) { orderQtyByProduct.set(i.productId, i.quantity); });

  const qtyByProduct = new Map();
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
    if (!orderQtyByProduct.has(productId)) {
      throw httpError(400, 'Product ' + productId + ' is not a line of this sales order');
    }
    qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + quantity);
  }
  return qtyByProduct;
}

// ---------------------------------------------------------------------------
// POST /sales-orders/:id/dispatch (ADMIN only)
// Creates the dispatch record, deducts stock (physical AND reserved) and
// moves the order to DISPATCHED - all in one transaction. The atomic
// CONFIRMED -> DISPATCHED claim prevents dispatching pending/cancelled
// orders and blocks duplicate dispatch even under concurrency.
// ---------------------------------------------------------------------------
async function dispatchSalesOrder(orderId, body) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid sales order id');
  const payload = body || {};

  const vehicleNumber = String(payload.vehicleNumber || '').trim();
  const driverName = String(payload.driverName || '').trim();
  if (!vehicleNumber) throw httpError(400, 'vehicleNumber is required');
  if (!driverName) throw httpError(400, 'driverName is required');

  const order = await prisma.salesOrder.findUnique({
    where: { id: id },
    include: {
      items: {
        include: { product: { select: { id: true, productCode: true, productName: true } } },
      },
    },
  });
  if (!order) throw httpError(404, 'Sales order not found');

  const qtyByProduct = normalizeDispatchItems(payload.items, order.items);

  // A dispatch line may never exceed the still-undispatched ordered quantity
  // for that product. Confirming the order reserved exactly the ordered
  // quantities, so this also enforces "must not exceed the reserved amount
  // for this order".
  const dispatchedRows = await prisma.dispatchItem.groupBy({
    by: ['productId'],
    where: { dispatch: { salesOrderId: id } },
    _sum: { quantity: true },
  });
  const alreadyDispatched = new Map();
  dispatchedRows.forEach(function (r) {
    alreadyDispatched.set(r.productId, (r._sum && r._sum.quantity) || 0);
  });

  qtyByProduct.forEach(function (quantity, productId) {
    const ordered = order.items.find(function (i) { return i.productId === productId; });
    const dispatched = alreadyDispatched.get(productId) || 0;
    const orderedQty = ordered ? ordered.quantity : 0;
    const remaining = orderedQty - dispatched;
    if (quantity > remaining) {
      const label = ordered && ordered.product
        ? ordered.product.productCode + ' ' + ordered.product.productName
        : 'product ' + productId;
      throw httpError(
        400,
        'Dispatch quantity for ' + label + ' exceeds the remaining ordered quantity ' +
        '(ordered ' + orderedQty + ', already dispatched ' + dispatched + ', remaining ' + remaining + ')'
      );
    }
  });

  return prisma.$transaction(async function (tx) {
    // Atomic status claim. 0 rows = order is not CONFIRMED (already
    // dispatched, cancelled, still pending, or a concurrent dispatch won).
    const claimed = await tx.$executeRaw`
      UPDATE sales_orders
         SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ${id} AND status = 'CONFIRMED'`;
    if (claimed === 0) {
      throw httpError(409, 'Only CONFIRMED sales orders can be dispatched (it may already be dispatched, cancelled or still pending)');
    }

    const dispatchNumber = await nextDocumentNumber(tx, 'DSP', 'DSP');

    const dispatch = await tx.dispatch.create({
      data: {
        dispatchNumber: dispatchNumber,
        salesOrderId: id,
        dispatchDate: new Date(),
        vehicleNumber: vehicleNumber,
        driverName: driverName,
        items: {
          create: Array.from(qtyByProduct.entries()).map(function (pair) {
            return { productId: pair[0], quantity: pair[1] };
          }),
        },
      },
      include: DISPATCH_INCLUDE,
    });

    // Deduct stock: physical AND reserved both decrease by the dispatched qty.
    for (const pair of Array.from(qtyByProduct.entries())) {
      const deducted = await inventoryService.deductDispatchedStock(tx, pair[0], pair[1]);
      if (!deducted) {
        throw httpError(
          409,
          'Inventory inconsistency while dispatching product ' + pair[0] +
          ': cannot deduct ' + pair[1] + ' units (reservation missing?)'
        );
      }
    }

    return dispatch;
  });
}

module.exports = { listDispatches, getDispatchById, dispatchSalesOrder };

