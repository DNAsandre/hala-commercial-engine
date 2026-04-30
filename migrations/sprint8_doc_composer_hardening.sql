-- Sprint 3 — Document Composer hardening migration
-- 1. Add UNIQUE constraint on doc_blocks.block_key (required for seed-blocks.ts upsert)
-- 2. Add compiled_at column to doc_instances (used by compile endpoint)
-- Run this in the Supabase SQL editor.

-- ═══════════════════════════════════════════════════════════════
-- 1. doc_blocks: Ensure block_key uniqueness
-- ═══════════════════════════════════════════════════════════════

-- Add UNIQUE constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'doc_blocks_block_key_key'
  ) THEN
    ALTER TABLE doc_blocks ADD CONSTRAINT doc_blocks_block_key_key UNIQUE (block_key);
    RAISE NOTICE 'Added UNIQUE constraint on doc_blocks.block_key';
  ELSE
    RAISE NOTICE 'UNIQUE constraint on doc_blocks.block_key already exists';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 2. doc_instances: Add compiled_at timestamp
-- ═══════════════════════════════════════════════════════════════

-- The compile endpoint writes compiled_at but the column may not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doc_instances' AND column_name = 'compiled_at'
  ) THEN
    ALTER TABLE doc_instances ADD COLUMN compiled_at TIMESTAMPTZ DEFAULT NULL;
    RAISE NOTICE 'Added compiled_at column to doc_instances';
  ELSE
    RAISE NOTICE 'compiled_at column already exists on doc_instances';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 3. doc_blocks: Add created_by column if missing
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doc_blocks' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE doc_blocks ADD COLUMN created_by TEXT DEFAULT NULL;
    RAISE NOTICE 'Added created_by column to doc_blocks';
  ELSE
    RAISE NOTICE 'created_by column already exists on doc_blocks';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 4. doc_blocks: Add updated_at column if missing
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doc_blocks' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE doc_blocks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to doc_blocks';
  ELSE
    RAISE NOTICE 'updated_at column already exists on doc_blocks';
  END IF;
END $$;
