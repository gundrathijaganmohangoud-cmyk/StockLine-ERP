require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const statements = [
    'ALTER TABLE inventory ADD CONSTRAINT inventory_physical_qty_nonnegative CHECK (physical_qty >= 0)',
    'ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_qty_nonnegative CHECK (reserved_qty >= 0)',
    'ALTER TABLE inventory ADD CONSTRAINT inventory_damaged_qty_nonnegative CHECK (damaged_qty >= 0)',
    'ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_plus_damaged_le_physical CHECK (reserved_qty + damaged_qty <= physical_qty)',
    'DROP INDEX IF EXISTS quotations_enquiry_id_key',
    "CREATE UNIQUE INDEX IF NOT EXISTS quotations_one_active_per_enquiry ON quotations (enquiry_id) WHERE status != 'REJECTED'",
  ];

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (error) {
      if (!String(error.message).includes('already exists')) throw error;
    }
  }

  const checks = await prisma.$queryRawUnsafe(
    "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.inventory'::regclass AND contype = 'c' ORDER BY conname"
  );
  const indexes = await prisma.$queryRawUnsafe(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'quotations' ORDER BY indexname"
  );
  const counts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    inventory: await prisma.inventory.count(),
    customers: await prisma.customer.count(),
  };

  console.log(JSON.stringify({ checks, indexes, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
