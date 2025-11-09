-- Migration: Drop obsolete assignedToId column from todos
-- Created: 2025-10-01
-- Safe / idempotent: uses IF EXISTS and CASCADE to remove associated FK/index if present

BEGIN;

-- Optional safety: rename the column first (uncomment to keep a quick fallback)
-- ALTER TABLE todos RENAME COLUMN IF EXISTS "assignedToId" TO "assignedToId_backup_2025_10_01";

-- Drop the column if it exists (cascade will remove FK constraints/indexes referencing it)
ALTER TABLE IF EXISTS todos DROP COLUMN IF EXISTS "assignedToId" CASCADE;

COMMIT;

-- Notes:
-- 1) This migration will permanently remove the column and any dependent constraints/indexes.
-- 2) Back up the DB before running (pg_dump) if you want a restore point.
-- 3) If you prefer a reversible approach, rename the column (see commented line above) instead of dropping it.
