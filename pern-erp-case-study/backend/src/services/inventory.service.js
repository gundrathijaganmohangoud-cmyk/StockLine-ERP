const { httpError } = require('../utils/apiResponse');

// ---------------------------------------------------------------------------
// WHY THE CONDITIONAL UPDATE BELOW IS RACE-SAFE
// (case-study scenario: User A reserves 80 units, User B reserves 50 units,
// only 100 units are physically in stock)
//
// A naive read-then-write flow would:
//   1. read available = physical - reserved            (both users read 100)
//   2. compare in JavaScript                          (both see 100 >= qty)
//   3. write reserved_qty = reserved_qty + qty        (last write wins)
// Result: reserved_qty = 80 + 50 = 130 against 100 physical units - the
// classic lost-update race condition.
//
// Instead, the availability check and the increment are fused into ONE
// atomic SQL statement. PostgreSQL serializes concurrent UPDATEs on the same
// row with a row lock:
//   - A's statement locks the row, re-checks the WHERE on the current version
//     (100 - 0 - 0 = 100 >= 80), updates reserved_qty 0 -> 80, commits.
//   - B's statement WAITS on A's row lock; when A commits, B RE-EVALUATES the
//     WHERE clause against the NEW row version: 100 - 80 - 0 = 20 < 50, so it
//     matches ZERO rows and reports 0 affected.
//   - 0 affected rows = "insufficient stock". The caller throws inside the
//     interactive Prisma transaction, which rolls back EVERYTHING (the status
//     claim and any earlier successful reservations of the same order).
// Because there is no read-then-write window, reserved_qty can never exceed
// physical_qty - damaged_qty, no matter how many orders confirm concurrently.
// ---------------------------------------------------------------------------

// Atomically reserves `quantity` units for a product.
// Returns true on success; false when 0 rows matched (insufficient stock).
async function reserveStock(tx, productId, quantity) {
  const affected = await tx.$executeRaw`
    UPDATE inventory
       SET reserved_qty = reserved_qty + ${quantity}
     WHERE product_id = ${productId}
       AND physical_qty - reserved_qty - damaged_qty >= ${quantity}`;
  return affected > 0;
}

// Atomically deducts dispatched quantity from physical AND reserved stock.
// The guards keep both counters non-negative (mirrors the DB CHECKs).
async function deductDispatchedStock(tx, productId, quantity) {
  const affected = await tx.$executeRaw`
    UPDATE inventory
       SET physical_qty = physical_qty - ${quantity},
         reserved_qty = reserved_qty - ${quantity}
     WHERE product_id = ${productId}
       AND physical_qty >= ${quantity}
       AND reserved_qty >= ${quantity}`;
  return affected > 0;
}

// Current availability (physical - reserved - damaged) per product id.
async function availabilityFor(productIds) {
  const prisma = require('../config/db');
  const rows = await prisma.inventory.findMany({
    where: { productId: { in: productIds } },
    include: { product: { select: { id: true, productCode: true, productName: true } } },
  });
  return rows.map(function (row) {
    return {
      productId: row.productId,
      product: row.product,
      physicalQty: row.physicalQty,
      reservedQty: row.reservedQty,
      damagedQty: row.damagedQty,
      availableQty: row.physicalQty - row.reservedQty - row.damagedQty,
    };
  });
}

function availableOf(row) {
  return row ? row.physicalQty - row.reservedQty - row.damagedQty : 0;
}

// Shared error for failed reservations (0 rows affected).
function insufficientStockError(details) {
  return httpError(409, 'Insufficient stock: ' + details);
}

module.exports = {
  reserveStock,
  deductDispatchedStock,
  availabilityFor,
  availableOf,
  insufficientStockError,
};

