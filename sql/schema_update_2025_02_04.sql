-- =============================================================================
-- Schema Update: 2025-02-04
-- Changes for: Bank Name in 7-Tabung, Monthly Rates for CBS/Khemah
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (1) Add bank_name column to accounting_config table
-- This allows users to specify which bank their 7-tabung allocations go to
-- -----------------------------------------------------------------------------

-- Check if column exists first (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_config' 
        AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE accounting_config 
        ADD COLUMN bank_name TEXT;
        
        RAISE NOTICE 'Added bank_name column to accounting_config table';
    ELSE
        RAISE NOTICE 'bank_name column already exists in accounting_config table';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (2) Add monthly rate columns for CBS and Khemah to locations table
-- This allows monthly locations to have different rates for Khemah vs CBS
-- -----------------------------------------------------------------------------

-- Check and add rate_monthly_khemah column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'locations' 
        AND column_name = 'rate_monthly_khemah'
    ) THEN
        ALTER TABLE locations 
        ADD COLUMN rate_monthly_khemah NUMERIC DEFAULT 0;
        
        RAISE NOTICE 'Added rate_monthly_khemah column to locations table';
    ELSE
        RAISE NOTICE 'rate_monthly_khemah column already exists in locations table';
    END IF;
END $$;

-- Check and add rate_monthly_cbs column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'locations' 
        AND column_name = 'rate_monthly_cbs'
    ) THEN
        ALTER TABLE locations 
        ADD COLUMN rate_monthly_cbs NUMERIC DEFAULT 0;
        
        RAISE NOTICE 'Added rate_monthly_cbs column to locations table';
    ELSE
        RAISE NOTICE 'rate_monthly_cbs column already exists in locations table';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- (3) Update RLS policies if needed (optional - only if you have specific needs)
-- The existing RLS policies should cover these new columns automatically
-- -----------------------------------------------------------------------------

-- Ensure the accounting_config table has proper RLS
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
-- (4) Grant permissions (ensure service_role can access)
-- -----------------------------------------------------------------------------

GRANT ALL ON accounting_config TO service_role;
GRANT ALL ON locations TO service_role;

-- -----------------------------------------------------------------------------
-- Verification queries (run these to check the changes)
-- -----------------------------------------------------------------------------

-- Check accounting_config columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'accounting_config';

-- Check locations columns  
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'locations' 
-- AND column_name LIKE 'rate%';

-- =============================================================================
-- End of Schema Update
-- =============================================================================
