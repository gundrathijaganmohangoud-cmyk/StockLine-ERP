-- IndustraFlow: CHECK constraints Prisma cannot express in the schema.
-- HOW TO APPLY:
--   Preferred: paste these statements at the bottom of the generated file
--   backend/prisma/migrations/<timestamp>_init/migration.sql BEFORE running
--   "npx prisma migrate dev" (or re-run migrate dev after editing) so they
--   become part of the migration history.
--   Alternative: apply directly with:
--     psql "$DATABASE_URL" -f backend/prisma/check-constraints.sql

ALTER TABLE inventory ADD CONSTRAINT inventory_physical_qty_nonnegative
  CHECK (physical_qty >= 0);

ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_qty_nonnegative
  CHECK (reserved_qty >= 0);

ALTER TABLE inventory ADD CONSTRAINT inventory_damaged_qty_nonnegative
  CHECK (damaged_qty >= 0);

ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_plus_damaged_le_physical
  CHECK (reserved_qty + damaged_qty <= physical_qty);
