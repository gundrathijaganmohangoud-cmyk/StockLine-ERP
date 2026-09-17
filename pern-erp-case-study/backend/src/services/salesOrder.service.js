const prisma = require('../config/db');
const { httpError } = require('../utils/apiResponse');
const inventoryService = require('./inventory.service');

const SALES_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'CANCELLED'];

function salesOrderDetailInclude() {
  return {
    quotation: { select: { id: true, quotationNumber: true, grandTotal: true, status: true } },
    customer: true,
    items: {
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            productName: true,
            unit: true,
            inventory: true,
          },
        },
      },
    },
  };
}

// availableQty = physical - reserved - damaged (live inventory per line)
function mapOrderWithAvailability(order) {
  const plain = JSON.parse(JSON.stringify(order));
  plain.items = plain.items.map(function (item) {
    const inv = item.product ? item.product.inventory : null;
    return Object.assign({}, item, {
      product: item.product
        ? Object.assign({}, item.product, { inventory: undefined })
        : item.product,
      availableQty: inv ? inv.physicalQty - inv.reservedQty - inv.damagedQty : 0,
      inventory: inv
        ? {
            physicalQty: inv.physicalQty,
            reservedQty: inv.reservedQty,
            damagedQty: inv.damagedQty,
          }
        : null,
    });
  });
  return plain;
}

async function listSalesOrders(filters) {
  const where = {};
  const status = filters && filters.status;
  if (status) {
    if (SALES_ORDER_STATUSES.indexOf(status) === -1) {
      throw httpError(400, 'Unknown status "' + status + '". Valid: ' + SALES_ORDER_STATUSES.join(', '));
    }
    where.status = status;
  }

  const rows = await prisma.salesOrder.findMany({
    where: where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { companyName: true } },
      quotation: { select: { id: true, quotationNumber: true, status: true } },
      _count: { select: { items: true, dispatches: true } },
    },
  });

  return rows.map(function (o) {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      quotation: o.quotation,
      customerName: o.customer ? o.customer.companyName : null,
      status: o.status,
      totalAmount: o.totalAmount,
      orderDate: o.orderDate,
      itemCount: o._count.items,
      dispatchCount: o._count.dispatches,
      createdAt: o.createdAt,
    };
  });
}

async function getSalesOrderById(id) {
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw httpError(400, 'Invalid sales order id');
  }
  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: salesOrderDetailInclude(),
  });
  if (!order) throw httpError(404, 'Sales order not found');
  return mapOrderWithAvailability(order);
}

// ---------------------------------------------------------------------------
// POST /sales-orders/:id/confirm (ADMIN only)
// Confirms a PENDING order = reserves inventory for every line, atomically.
// The deep "why this is race-safe" explanation lives in inventory.service.js
// (reserveStock): check + increment are ONE conditional UPDATE per line, run
// inside an interactive transaction, so concurrent confirms serialize on the
// inventory row lock and a losing reservation rolls back the whole order.
// ---------------------------------------------------------------------------
async function confirmSalesOrder(orderId) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid sales order id');

  const order = await prisma.salesOrder.findUnique({
    where: { id: id },
    include: {
      items: {
        include: { product: { select: { id: true, productCode: true, productName: true } } },
      },
    },
  });
  if (!order) throw httpError(404, 'Sales order not found');

  return prisma.$transaction(
    async function (tx) {
      // Atomic status claim: PENDING -> CONFIRMED. 0 rows affected means the
      // order is not confirmable (wrong status, or a concurrent confirm won).
      const claimed = await tx.$executeRaw`
        UPDATE sales_orders
           SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP
         WHERE id = ${id} AND status = 'PENDING'`;
      if (claimed === 0) {
        throw httpError(400, 'Only PENDING sales orders can be confirmed (current status: ' + order.status + ')');
      }

      // Reserve stock line by line with the atomic conditional UPDATE.
      const shortfalls = [];
      for (const item of order.items) {
        const reserved = await inventoryService.reserveStock(tx, item.productId, item.quantity);
        if (!reserved) shortfalls.push(item);
      }

      if (shortfalls.length > 0) {
        // Throwing here rolls back the status claim AND every reservation
        // already made for earlier lines of this order - all-or-nothing.
        const rows = await tx.inventory.findMany({
          where: { productId: { in: shortfalls.map(function (s) { return s.productId; }) } },
        });
        const details = shortfalls
          .map(function (s) {
            const row = rows.find(function (r) { return r.productId === s.productId; });
            const available = inventoryService.availableOf(row);
            const label = s.product
              ? s.product.productCode + ' ' + s.product.productName
              : 'product ' + s.productId;
            return label + ' (required ' + s.quantity + ', available ' + available + ')';
          })
          .join('; ');
        throw inventoryService.insufficientStockError(details);
      }

      const confirmed = await tx.salesOrder.findUnique({
        where: { id: id },
        include: salesOrderDetailInclude(),
      });
      return mapOrderWithAvailability(confirmed);
    },
    { isolationLevel: 'ReadCommitted' }
  );
}

module.exports = {
  listSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
  SALES_ORDER_STATUSES,
};

