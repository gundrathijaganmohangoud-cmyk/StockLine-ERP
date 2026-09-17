const { PrismaClient } = require('@prisma/client');

// Single PrismaClient instance shared across the app. Cached on globalThis in
// non-production so Jest re-requires don't open new connection pools.
const prisma = global.__industraflowPrisma || new PrismaClient({
  transactionOptions: {
    maxWait: 15000,
    timeout: 30000,
  },
});

if (process.env.NODE_ENV !== 'production') {
  global.__industraflowPrisma = prisma;
}

module.exports = prisma;

