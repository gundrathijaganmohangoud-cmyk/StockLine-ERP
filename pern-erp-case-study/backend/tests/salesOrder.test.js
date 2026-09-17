const request = require('supertest');
const { app, prisma, resetDatabase, login, authHeader, createProduct, createTestCustomer } = require('./helpers');

describe('Sales Order conversion', () => {
  let adminToken;
  let salesToken;
  let customer;
  let pipe;
  let bearing;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await login('admin@test.local');
    salesToken = await login('sales@test.local');
    customer = await createTestCustomer('SO Test Co');
    pipe = await createProduct('SO-PIPE', 100.0, { physicalQty: 500, reservedQty: 0 });
    bearing = await createProduct('SO-BRG', 200.0, { physicalQty: 500, reservedQty: 0 });
  });

  async function makeQuotation(status) {
    const enquiry = await request(app)
      .post('/api/enquiries')
      .set(authHeader(salesToken))
      .send({
        customerId: customer.id,
        enquiryDate: '2026-09-17',
        items: [{ productId: pipe.id, quantity: 5 }],
      });
    expect(enquiry.status).toBe(201);

    const quotation = await request(app)
      .post('/api/quotations')
      .set(authHeader(salesToken))
      .send({
        enquiryId: enquiry.body.id,
        items: [{ productId: pipe.id, quantity: 5, unitPrice: 100.0, discountPct: 0, gstPct: 0 }],
      });
    expect(quotation.status).toBe(201);

    if (status !== 'DRAFT') {
      await request(app)
        .patch('/api/quotations/' + quotation.body.id + '/status')
        .set(authHeader(salesToken))
        .send({ status: 'SENT' });
      if (status === 'ACCEPTED' || status === 'REJECTED') {
        await request(app)
          .patch('/api/quotations/' + quotation.body.id + '/status')
          .set(authHeader(salesToken))
          .send({ status: status });
      }
    }
    return quotation.body.id;
  }

  test('a DRAFT quotation fails to convert (400)', async () => {
    const quotationId = await makeQuotation('DRAFT');
    const res = await request(app)
      .post('/api/quotations/' + quotationId + '/convert')
      .set(authHeader(salesToken));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only ACCEPTED quotations can be converted/);

    const count = await prisma.salesOrder.count({ where: { quotationId: quotationId } });
    expect(count).toBe(0);
  });

  test('a REJECTED quotation fails to convert (400)', async () => {
    const quotationId = await makeQuotation('REJECTED');
    const res = await request(app)
      .post('/api/quotations/' + quotationId + '/convert')
      .set(authHeader(salesToken));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only ACCEPTED quotations can be converted/);

    const count = await prisma.salesOrder.count({ where: { quotationId: quotationId } });
    expect(count).toBe(0);
  });

  test('converting the same ACCEPTED quotation twice does not create two sales orders (second attempt 409)', async () => {
    const quotationId = await makeQuotation('ACCEPTED');

    const first = await request(app)
      .post('/api/quotations/' + quotationId + '/convert')
      .set(authHeader(salesToken));
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('PENDING');
    expect(first.body.orderNumber).toMatch(/^SO-\d{4}$/);

    const second = await request(app)
      .post('/api/quotations/' + quotationId + '/convert')
      .set(authHeader(salesToken));
    expect(second.status).toBe(409);

    const count = await prisma.salesOrder.count({ where: { quotationId: quotationId } });
    expect(count).toBe(1);
  });
});

