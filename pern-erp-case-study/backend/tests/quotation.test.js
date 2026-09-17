const request = require('supertest');
const { app, prisma, resetDatabase, login, authHeader, createProduct, createTestCustomer } = require('./helpers');

describe('Quotation API - server-authoritative pricing', () => {
  let adminToken;
  let salesToken;
  let customer;
  let pipe;
  let bearing;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await login('admin@test.local');
    salesToken = await login('sales@test.local');
    customer = await createTestCustomer('Quotation Test Co');
    pipe = await createProduct('QTN-PIPE', 100.0, { physicalQty: 500, reservedQty: 10 });
    bearing = await createProduct('QTN-BRG', 200.0, { physicalQty: 500, reservedQty: 0 });
  });

  test('grand_total is calculated correctly server-side for discount/GST inputs', async () => {
    // Line 1: 10 x 100.00, 10% discount, 18% GST
    //   base=1000 -> after discount=900 -> +18% GST = 1062.00
    // Line 2: 5 x 200.00, 0% discount, 5% GST
    //   base=1000 -> after discount=1000 -> +5% GST = 1050.00
    // Expected grand total = 2112.00
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set(authHeader(salesToken))
      .send({
        customerId: customer.id,
        enquiryDate: '2026-09-17',
        items: [
          { productId: pipe.id, quantity: 10 },
          { productId: bearing.id, quantity: 5 },
        ],
      });
    expect(enquiry.status).toBe(201);

    const res = await request(app)
      .post('/api/quotations')
      .set(authHeader(salesToken))
      .send({
        enquiryId: enquiry.body.id,
        items: [
          { productId: pipe.id, quantity: 10, unitPrice: 100.0, discountPct: 10, gstPct: 18 },
          { productId: bearing.id, quantity: 5, unitPrice: 200.0, discountPct: 0, gstPct: 5 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');

    const lines = res.body.items;
    expect(Number(lines[0].lineAmount)).toBeCloseTo(1062.0, 2);
    expect(Number(lines[1].lineAmount)).toBeCloseTo(1050.0, 2);
    expect(Number(res.body.grandTotal)).toBeCloseTo(2112.0, 2);

    // GET detail recalculates independently and must agree.
    const detail = await request(app)
      .get('/api/quotations/' + res.body.id)
      .set(authHeader(salesToken));
    expect(detail.status).toBe(200);
    expect(Number(detail.body.recalculatedGrandTotal)).toBeCloseTo(2112.0, 2);
    expect(Number(detail.body.grandTotal)).toBeCloseTo(2112.0, 2);
  });

  test('a spoofed total in the request body is ignored', async () => {
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set(authHeader(salesToken))
      .send({
        customerId: customer.id,
        enquiryDate: '2026-09-17',
        items: [{ productId: pipe.id, quantity: 1 }],
      });
    expect(enquiry.status).toBe(201);

    // The client claims a grandTotal of 1 rupee; the truth is 118.00.
    const res = await request(app)
      .post('/api/quotations')
      .set(authHeader(salesToken))
      .send({
        enquiryId: enquiry.body.id,
        grandTotal: 1,
        items: [{ productId: pipe.id, quantity: 1, unitPrice: 100.0, discountPct: 0, gstPct: 18, lineAmount: 0.01 }],
      });
    expect(res.status).toBe(201);
    expect(Number(res.body.grandTotal)).toBeCloseTo(118.0, 2);
    expect(Number(res.body.items[0].lineAmount)).toBeCloseTo(118.0, 2);

    // The stored quotation in the database must carry the server-computed value.
    const stored = await prisma.quotation.findUnique({
      where: { id: res.body.id },
      include: { items: true },
    });
    expect(Number(stored.grandTotal)).toBeCloseTo(118.0, 2);
    expect(Number(stored.items[0].lineAmount)).toBeCloseTo(118.0, 2);
  });

  test('invalid status transitions are rejected (DRAFT -> ACCEPTED)', async () => {
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set(authHeader(salesToken))
      .send({
        customerId: customer.id,
        enquiryDate: '2026-09-17',
        items: [{ productId: pipe.id, quantity: 2 }],
      });

    const quotation = await request(app)
      .post('/api/quotations')
      .set(authHeader(salesToken))
      .send({
        enquiryId: enquiry.body.id,
        items: [{ productId: pipe.id, quantity: 2, unitPrice: 50.0, discountPct: 0, gstPct: 0 }],
      });

    const res = await request(app)
      .patch('/api/quotations/' + quotation.body.id + '/status')
      .set(authHeader(adminToken))
      .send({ status: 'ACCEPTED' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid status transition/);
  });
});

