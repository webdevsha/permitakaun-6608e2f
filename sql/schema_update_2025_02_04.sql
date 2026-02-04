-- =============================================================================
-- Schema Update: 2025-02-04
-- Changes for: 7 Individual Bank Names for 7-Tabung, Monthly Rates for CBS/Khemah
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1) Add bank_names JSONB column to accounting_config table
-- This stores individual bank names for each of the 7 tabungs
-- JSON structure: {"operating": "Maybank", "tax": "LHDN", "zakat": "PPZ", ...}
-- -----------------------------------------------------------------------------

-- First, drop the old bank_name column if it exists (from previous partial implementation)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_config' 
        AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE accounting_config DROP COLUMN bank_name;
        RAISE NOTICE 'Dropped old bank_name column';
    END IF;
END $$;

-- Add bank_names JSONB column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_config' 
        AND column_name = 'bank_names'
    ) THEN
        ALTER TABLE accounting_config 
        ADD COLUMN bank_names JSONB DEFAULT '{
            "operating": "",
            "tax": "",
            "zakat": "",
            "investment": "",
            "dividend": "",
            "savings": "",
            "emergency": ""
        }'::jsonb;
        
        RAISE NOTICE 'Added bank_names JSONB column to accounting_config table';
    ELSE
        RAISE NOTICE 'bank_names column already exists in accounting_config table';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (2) Add monthly rate columns for CBS and Khemah to locations table
-- This allows monthly locations to have different rates for different stall types
-- -----------------------------------------------------------------------------

-- Check and add rate_monthly_khemah column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' AND column_name = 'rate_monthly_khemah'
    ) THEN
        ALTER TABLE locations ADD COLUMN rate_monthly_khemah NUMERIC DEFAULT 0;
        RAISE NOTICE 'Added rate_monthly_khemah column to locations table';
    ELSE
        RAISE NOTICE 'rate_monthly_khemah column already exists in locations table';
    END IF;
END $$;

-- Check and add rate_monthly_cbs column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' AND column_name = 'rate_monthly_cbs'
    ) THEN
        ALTER TABLE locations ADD COLUMN rate_monthly_cbs NUMERIC DEFAULT 0;
        RAISE NOTICE 'Added rate_monthly_cbs column to locations table';
    ELSE
        RAISE NOTICE 'rate_monthly_cbs column already exists in locations table';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (3) Update RLS policies for accounting_config
-- -----------------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE accounting_config ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for users to manage their own config
DROP POLICY IF EXISTS "Users can manage their own accounting config" ON accounting_config;

CREATE POLICY "Users can manage their own accounting config"
ON accounting_config
FOR ALL
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Allow admins to view all configs
DROP POLICY IF EXISTS "Admins can view all accounting configs" ON accounting_config;

CREATE POLICY "Admins can view all accounting configs"
ON accounting_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('admin', 'superadmin', 'staff')
    )
);

-- -----------------------------------------------------------------------------
-- (4) Grant permissions
-- -----------------------------------------------------------------------------

GRANT ALL ON accounting_config TO service_role;
GRANT ALL ON locations TO service_role;

-- -----------------------------------------------------------------------------
-- (5) Backfill existing data (optional)
-- If you have existing data with the old bank_name, migrate it to operating
-- -----------------------------------------------------------------------------

-- Uncomment this section if you need to migrate old data:
/*
UPDATE accounting_config 
SET bank_names = jsonb_set(
    COALESCE(bank_names, '{}'::jsonb),
    '{operating}',
    to_jsonb(bank_name)
)
WHERE bank_name IS NOT NULL 
AND bank_name != ''
AND (bank_names IS NULL OR bank_names->>'operating' = '');
*/

-- -----------------------------------------------------------------------------
-- Verification queries (run these to check the changes)
-- -----------------------------------------------------------------------------

-- Check accounting_config columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'accounting_config';

-- Check bank_names structure
-- SELECT profile_id, bank_names 
-- FROM accounting_config 
-- LIMIT 5;

-- Check locations table rate columns
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'locations' 
-- AND column_name LIKE 'rate%';

-- =============================================================================
-- End of Schema Update
-- =============================================================================
