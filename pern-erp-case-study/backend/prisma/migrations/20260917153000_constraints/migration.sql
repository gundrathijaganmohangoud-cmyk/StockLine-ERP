-- Database-level invariants not expressible in Prisma schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_physical_qty_nonnegative') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_physical_qty_nonnegative CHECK (physical_qty >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reserved_qty_nonnegative') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_qty_nonnegative CHECK (reserved_qty >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_damaged_qty_nonnegative') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_damaged_qty_nonnegative CHECK (damaged_qty >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_reserved_plus_damaged_le_physical') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_reserved_plus_damaged_le_physical CHECK (reserved_qty + damaged_qty <= physical_qty);
  END IF;
END $$;

DROP INDEX IF EXISTS quotations_enquiry_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_one_active_per_enquiry
  ON quotations (enquiry_id)
  WHERE status != 'REJECTED';