const request = require('supertest');
const { app, prisma, resetDatabase, login, authHeader, createProduct, createTestCustomer, createPendingOrder } = require('./helpers');

describe('Inventory reservation (confirm)', () => {
  let adminToken;
  let salesToken;
  let customer;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await login('admin@test.local');
    salesToken = await login('sales@test.local');
    customer = await createTestCustomer('Inventory Test Co');
  });

  async function inventoryOf(productId) {
    const inv = await prisma.inventory.findUnique({ where: { productId: productId } });
    return {
      physicalQty: inv.physicalQty,
      reservedQty: inv.reservedQty,
      damagedQty: inv.damagedQty,
    };
  }

  test('confirming an order requiring more than available inventory is rejected and inventory is unchanged', async () => {
    // 100 physical, 0 reserved, 0 damaged -> 100 available. Order 150.
    const pipe = await createProduct('INV-PIPE', 100.0, { physicalQty: 100, reservedQty: 0 });
    const { salesOrder } = await createPendingOrder(salesToken, customer, [
      { productId: pipe.id, quantity: 150, unitPrice: 100.0 },
    ]);

    const before = await inventoryOf(pipe.id);

    const res = await request(app)
      .post('/api/sales-orders/' + salesOrder.id + '/confirm')
      .set(authHeader(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Insufficient stock/);
    expect(res.body.error).toMatch(/required 150, available 100/);

    // Inventory must be untouched: no partial reservation, status still PENDING.
    const after = await inventoryOf(pipe.id);
    expect(after).toEqual(before);

    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrder.id } });
    expect(order.status).toBe('PENDING');
  });

  test('a successful confirm reserves stock (status CONFIRMED, reserved incremented)', async () => {
    const valve = await createProduct('INV-VALVE', 3200.0, { physicalQty: 200, reservedQty: 20 });
    const { salesOrder } = await createPendingOrder(salesToken, customer, [
      { productId: valve.id, quantity: 30, unitPrice: 3200.0 },
    ]);

    const before = await inventoryOf(valve.id);

    const res = await request(app)
      .post('/api/sales-orders/' + salesOrder.id + '/confirm')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONFIRMED');

    const after = await inventoryOf(valve.id);
    expect(after.reservedQty).toBe(before.reservedQty + 30);
    expect(after.physicalQty).toBe(before.physicalQty);
  });
});

describe('Concurrent confirmation race condition', () => {
  let adminToken;
  let salesToken;
  let customer;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await login('admin@test.local');
    salesToken = await login('sales@test.local');
    customer = await createTestCustomer('Concurrency Test Co');
  });

  test('two concurrent confirms on limited stock never over-reserve (only valid reservations succeed)', async () => {
    // 100 available. Order A wants 80, Order B wants 50. Only one can fit.
    const motor = await createProduct('CC-MOTOR', 18500.0, { physicalQty: 100, reservedQty: 0 });

    const orderA = await createPendingOrder(salesToken, customer, [
      { productId: motor.id, quantity: 80, unitPrice: 18500.0 },
    ]);
    const orderB = await createPendingOrder(salesToken, customer, [
      { productId: motor.id, quantity: 50, unitPrice: 18500.0 },
    ]);

    // Fire both confirms at the same time.
    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/sales-orders/' + orderA.salesOrder.id + '/confirm')
        .set(authHeader(adminToken)),
      request(app)
        .post('/api/sales-orders/' + orderB.salesOrder.id + '/confirm')
        .set(authHeader(adminToken)),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one succeeds; the other gets 409 insufficient stock.
    expect(statuses).toEqual([200, 409]);

    // Invariant: reserved never exceeds physical.
    const inv = await inventoryOf(motor.id);
    expect(inv.reservedQty).toBeLessThanOrEqual(inv.physicalQty);
    // The winner's quantity (80 or 50) is fully reserved - no partial state.
    expect([80, 50]).toContain(inv.reservedQty);

    // Exactly one order is CONFIRMED, the other stays PENDING.
    const a = await prisma.salesOrder.findUnique({ where: { id: orderA.salesOrder.id } });
    const b = await prisma.salesOrder.findUnique({ where: { id: orderB.salesOrder.id } });
    const confirmedCount = [a.status, b.status].filter(function (s) { return s === 'CONFIRMED'; }).length;
    expect(confirmedCount).toBe(1);
  });
});

