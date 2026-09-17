const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, prisma, resetDatabase, login, authHeader, createProduct, createTestCustomer, createPendingOrder } = require('./helpers');

describe('RBAC and authentication', () => {
  let adminToken;
  let salesToken;
  let customer;
  let pipe;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await login('admin@test.local');
    salesToken = await login('sales@test.local');
    customer = await createTestCustomer('RBAC Test Co');
    pipe = await createProduct('RBAC-PIPE', 100.0, { physicalQty: 1000, reservedQty: 0 });
  });

  test('SALES role gets 403 when confirming a sales order', async () => {
    const { salesOrder } = await createPendingOrder(salesToken, customer, [
      { productId: pipe.id, quantity: 5, unitPrice: 100.0 },
    ]);

    const res = await request(app)
      .post('/api/sales-orders/' + salesOrder.id + '/confirm')
      .set(authHeader(salesToken));
    expect(res.status).toBe(403);

    const unchanged = await prisma.salesOrder.findUnique({ where: { id: salesOrder.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  test('SALES role gets 403 when dispatching a sales order', async () => {
    const { salesOrder } = await createPendingOrder(salesToken, customer, [
      { productId: pipe.id, quantity: 3, unitPrice: 100.0 },
    ]);

    const res = await request(app)
      .post('/api/sales-orders/' + salesOrder.id + '/dispatch')
      .set(authHeader(salesToken))
      .send({
        vehicleNumber: 'KA01AB1234',
        driverName: 'Test Driver',
        items: [{ productId: pipe.id, quantity: 3 }],
      });
    expect(res.status).toBe(403);
  });

  test('requests without a token get 401', async () => {
    const res = await request(app).get('/api/enquiries');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('malformed tokens get 401', async () => {
    const res = await request(app)
      .get('/api/enquiries')
      .set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid or malformed token/);
  });

  test('expired tokens get 401 with a clear message', async () => {
    const expired = jwt.sign(
      { userId: 1, role: 'ADMIN' },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/enquiries')
      .set('Authorization', 'Bearer ' + expired);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  test('login rejects wrong credentials (401) and missing fields (400)', async () => {
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'wrong' });
    expect(bad.status).toBe(401);

    const missing = await request(app).post('/api/auth/login').send({});
    expect(missing.status).toBe(400);
  });
});

