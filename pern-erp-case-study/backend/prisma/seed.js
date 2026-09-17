// Seed script: run with `npx prisma db seed` (configured in package.json).
// Idempotent: safe to run repeatedly (upserts).
require('dotenv').config();

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

const PRODUCTS = [
  { productCode: 'STL-PIPE-2IN', productName: 'Stainless Steel Pipe 2in Sch40', category: 'Piping', unit: 'meter', basePrice: 1250.0 },
  { productCode: 'BRG-SKF-6205', productName: 'Deep Groove Ball Bearing 6205', category: 'Bearings', unit: 'piece', basePrice: 480.0 },
  { productCode: 'VLV-GATE-2IN', productName: 'Industrial Gate Valve 2in', category: 'Valves', unit: 'piece', basePrice: 3200.0 },
  { productCode: 'MTR-3PH-5HP', productName: '3-Phase Induction Motor 5HP', category: 'Motors', unit: 'piece', basePrice: 18500.0 },
  { productCode: 'FST-HEX-M12', productName: 'Hex Bolt M12x50 (pack of 100)', category: 'Fasteners', unit: 'pack', basePrice: 640.0 },
  { productCode: 'CNV-BLT-600', productName: 'Conveyor Belt PVC 600mm (per m)', category: 'Conveyors', unit: 'meter', basePrice: 2100.0 },
];

// reserved_qty is deliberately below physical_qty everywhere.
const INVENTORY = [
  { productCode: 'STL-PIPE-2IN', physicalQty: 850, reservedQty: 60, damagedQty: 5 },
  { productCode: 'BRG-SKF-6205', physicalQty: 2400, reservedQty: 150, damagedQty: 0 },
  { productCode: 'VLV-GATE-2IN', physicalQty: 320, reservedQty: 40, damagedQty: 2 },
  { productCode: 'MTR-3PH-5HP', physicalQty: 95, reservedQty: 10, damagedQty: 1 },
  { productCode: 'FST-HEX-M12', physicalQty: 1500, reservedQty: 200, damagedQty: 0 },
  { productCode: 'CNV-BLT-600', physicalQty: 610, reservedQty: 45, damagedQty: 0 },
];

const CUSTOMERS = [
  { companyName: 'Bharat Heavy Industries Ltd', contactPerson: 'Ramesh Kulkarni', mobile: '9822011234', email: 'ramesh.kulkarni@bhi.example.com', city: 'Pune' },
  { companyName: 'Deccan Precision Engineering', contactPerson: 'Fatima Sheikh', mobile: '9845056789', email: 'fatima.sheikh@deccanprec.example.com', city: 'Hyderabad' },
  { companyName: 'Coastal Cement Works', contactPerson: 'Arun Pillai', mobile: '9740098765', email: 'arun.pillai@coastalcement.example.com', city: 'Mangalore' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: 'admin@industraflow.com' },
    update: { role: 'ADMIN', passwordHash: passwordHash },
    create: { email: 'admin@industraflow.com', passwordHash: passwordHash, role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'sales@industraflow.com' },
    update: { role: 'SALES', passwordHash: passwordHash },
    create: { email: 'sales@industraflow.com', passwordHash: passwordHash, role: 'SALES' },
  });

  const productsByCode = {};
  for (const product of PRODUCTS) {
    const created = await prisma.product.upsert({
      where: { productCode: product.productCode },
      update: {
        productName: product.productName,
        category: product.category,
        unit: product.unit,
        basePrice: product.basePrice,
      },
      create: product,
    });
    productsByCode[product.productCode] = created;
  }

  for (const inv of INVENTORY) {
    const product = productsByCode[inv.productCode];
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        physicalQty: inv.physicalQty,
        reservedQty: inv.reservedQty,
        damagedQty: inv.damagedQty,
      },
      create: {
        productId: product.id,
        physicalQty: inv.physicalQty,
        reservedQty: inv.reservedQty,
        damagedQty: inv.damagedQty,
      },
    });
  }

  for (const customer of CUSTOMERS) {
    const existing = await prisma.customer.findFirst({ where: { companyName: customer.companyName } });
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: customer });
    } else {
      await prisma.customer.create({ data: customer });
    }
  }

  // Document counters used for ENQ-0001/QTN-0001/SO-0001/DSP-0001 numbers.
  const counterTypes = ['ENQ', 'QTN', 'SO', 'DSP'];
  for (const docType of counterTypes) {
    const existing = await prisma.documentCounter.findUnique({ where: { docType: docType } });
    if (!existing) {
      await prisma.documentCounter.create({ data: { docType: docType, lastNumber: 0 } });
    }
  }

  console.log('Seed complete:');
  console.log('  users: admin@industraflow.com (ADMIN), sales@industraflow.com (SALES)');
  console.log('  password for both: ' + DEFAULT_PASSWORD);
  console.log('  products: ' + PRODUCTS.length + ', inventory rows: ' + INVENTORY.length + ', customers: ' + CUSTOMERS.length);
}

main()
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  })
  .finally(function () {
    return prisma.$disconnect();
  });

