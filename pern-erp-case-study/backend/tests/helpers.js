// Shared test helpers. Requires the app ONCE (Jest --runInBand, single module
// cache) and a dedicated test database (see global-setup.js).
//
// The database is truncated and re-baselined by resetDatabase() so tests never
// pollute development data. Point TEST_DATABASE_URL at a separate database
// (e.g. pern_erp_test) in backend/.env.
require('dotenv').config();

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const supertest = require('supertest');

const prisma = global.__industraflowPrisma || new PrismaClient();
global.__industraflowPrisma = prisma;

// app must be required AFTER prisma is cached and env is set.
const app = require('../src/app');

const TEST_PASSWORD = 'Password123!';

const TABLES = [
  'dispatch_items',
  'dispatches',
  'sales_order_items',
  'sales_orders',
  'quotation_items',
  'quotations',
  'enquiry_items',
  'enquiries',
  'inventory',
  'products',
  'customers',
  'users',
  'document_counters',
];

async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE ' +
      TABLES.map(function (t) { return '"' + t + '"'; }).join(', ') +
      ' RESTART IDENTITY CASCADE'
  );

  // Document counters must exist for ENQ/QTN/SO/DSP numbering.
  await prisma.documentCounter.createMany({
    data: [
      { docType: 'ENQ', lastNumber: 0 },
      { docType: 'QTN', lastNumber: 0 },
      { docType: 'SO', lastNumber: 0 },
      { docType: 'DSP', lastNumber: 0 },
    ],
  });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 6);
  const admin = await prisma.user.create({
    data: { email: 'admin@test.local', passwordHash: passwordHash, role: 'ADMIN' },
  });
  const sales = await prisma.user.create({
    data: { email: 'sales@test.local', passwordHash: passwordHash, role: 'SALES' },
  });
  return { admin: admin, sales: sales };
}

async function login(email) {
  const res = await supertest(app)
    .post('/api/auth/login')
    .send({ email: email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error('login failed for ' + email + ': ' + res.status + ' ' + JSON.stringify(res.body));
  }
  return res.body.token;
}

function authHeader(token) {
  return { Authorization: 'Bearer ' + token };
}

// Creates a product with an inventory row in one go.
async function createProduct(code, basePrice, inventory) {
  return prisma.product.create({
    data: {
      productCode: code,
      productName: 'Product ' + code,
      category: 'Test',
      unit: 'piece',
      basePrice: basePrice,
      inventory: {
        create: {
          physicalQty: inventory.physicalQty,
          reservedQty: inventory.reservedQty || 0,
          damagedQty: inventory.damagedQty || 0,
        },
      },
    },
    include: { inventory: true },
  });
}

async function createTestCustomer(name) {
  return prisma.customer.create({
    data: {
      companyName: name || 'Test Customer ' + Date.now() + Math.floor(Math.random() * 1000),
      contactPerson: 'Test Contact',
      mobile: '9000000000',
    },
  });
}

// enquiry -> quotation -> SENT -> ACCEPTED -> convert. Returns the PENDING
// sales order created through the public API.
async function createPendingOrder(token, customer, lines) {
  const enquiryRes = await supertest(app)
    .post('/api/enquiries')
    .set(authHeader(token))
    .send({
      customerId: customer.id,
      enquiryDate: '2026-09-17',
      items: lines.map(function (l) {
        return { productId: l.productId, quantity: l.quantity };
      }),
    });
  if (enquiryRes.status !== 201) {
    throw new Error('enquiry create failed: ' + JSON.stringify(enquiryRes.body));
  }

  const quotationRes = await supertest(app)
    .post('/api/quotations')
    .set(authHeader(token))
    .send({
      enquiryId: enquiryRes.body.id,
      items: lines.map(function (l) {
        return {
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct || 0,
          gstPct: l.gstPct || 0,
        };
      }),
    });
  if (quotationRes.status !== 201) {
    throw new Error('quotation create failed: ' + JSON.stringify(quotationRes.body));
  }
  const quotationId = quotationRes.body.id;

  const sent = await supertest(app)
    .patch('/api/quotations/' + quotationId + '/status')
    .set(authHeader(token))
    .send({ status: 'SENT' });
  if (sent.status !== 200) throw new Error('send failed: ' + JSON.stringify(sent.body));

  const accepted = await supertest(app)
    .patch('/api/quotations/' + quotationId + '/status')
    .set(authHeader(token))
    .send({ status: 'ACCEPTED' });
  if (accepted.status !== 200) throw new Error('accept failed: ' + JSON.stringify(accepted.body));

  const convertRes = await supertest(app)
    .post('/api/quotations/' + quotationId + '/convert')
    .set(authHeader(token));
  if (convertRes.status !== 201) {
    throw new Error('convert failed: ' + JSON.stringify(convertRes.body));
  }
  return { quotationId: quotationId, salesOrder: convertRes.body };
}

module.exports = {
  prisma: prisma,
  app: app,
  resetDatabase: resetDatabase,
  login: login,
  authHeader: authHeader,
  createProduct: createProduct,
  createTestCustomer: createTestCustomer,
  createPendingOrder: createPendingOrder,
  TEST_PASSWORD: TEST_PASSWORD,
};
