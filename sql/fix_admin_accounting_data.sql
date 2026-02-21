-- ============================================================================
-- FIX: Admin Accounting Data Visibility
-- ============================================================================

-- ============================================================================
-- STEP 1: Check current data state
-- ============================================================================
SELECT 'Current transaction counts by organizer:' as info;

SELECT 
    o.name as organizer_name,
    o.organizer_code,
    o.email,
    COUNT(ot.id) as transaction_count
FROM public.organizers o
LEFT JOIN public.organizer_transactions ot ON ot.organizer_id = o.id
GROUP BY o.id, o.name, o.organizer_code, o.email
ORDER BY transaction_count DESC;

-- ============================================================================
-- STEP 2: Check if admin@kumim.my has organizer record
-- ============================================================================
SELECT 
    'Admin organizer check' as check_type,
    EXISTS(SELECT 1 FROM public.organizers WHERE email = 'admin@kumim.my') as has_organizer_record,
    (SELECT id FROM public.organizers WHERE email = 'admin@kumim.my') as organizer_id,
    (SELECT organizer_code FROM public.organizers WHERE email = 'admin@kumim.my') as org_code;

-- ============================================================================
-- STEP 3: Create sample transactions for testing if none exist
-- ============================================================================
DO $$
DECLARE
    admin_org_id UUID;
    kumim_org_id UUID;
BEGIN
    -- Get Kumim's organizer ID
    SELECT id INTO kumim_org_id FROM public.organizers WHERE email = 'admin@kumim.my';
    
    IF kumim_org_id IS NULL THEN
        RAISE NOTICE 'Kumim organizer not found!';
        RETURN;
    END IF;
    
    -- Check if any transactions exist for Kumim
    IF EXISTS(SELECT 1 FROM public.organizer_transactions WHERE organizer_id = kumim_org_id) THEN
        RAISE NOTICE 'Transactions already exist for Kumim (ORG002)';
    ELSE
        RAISE NOTICE 'No transactions found for Kumim (ORG002). Creating sample transactions...';
        
        -- Insert sample income transaction
        INSERT INTO public.organizer_transactions (
            organizer_id,
            amount,
            type,
            category,
            description,
            date,
            status,
            is_auto_generated,
            created_at
        ) VALUES (
            kumim_org_id,
            5000.00,
            'income',
            'Sewa',
            'Bayaran sewa tapak - Pasar Malam Taman Sri Rampai',
            CURRENT_DATE - INTERVAL '5 days',
            'approved',
            false,
            NOW()
        );
        
        -- Insert sample expense transaction
        INSERT INTO public.organizer_transactions (
            organizer_id,
            amount,
            type,
            category,
            description,
            date,
            status,
            is_auto_generated,
            created_at
        ) VALUES (
            kumim_org_id,
            1200.00,
            'expense',
            'Utiliti',
            'Bayaran bil elektrik dan air',
            CURRENT_DATE - INTERVAL '3 days',
            'approved',
            false,
            NOW()
        );
        
        -- Insert another income
        INSERT INTO public.organizer_transactions (
            organizer_id,
            amount,
            type,
            category,
            description,
            date,
            status,
            is_auto_generated,
            created_at
        ) VALUES (
            kumim_org_id,
            3500.00,
            'income',
            'Sewa',
            'Bayaran sewa - Bazaar Ramadan Setiawangsa',
            CURRENT_DATE - INTERVAL '1 day',
            'approved',
            false,
            NOW()
        );
        
        RAISE NOTICE 'Created 3 sample transactions for Kumim (ORG002)';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: Create admin_transactions entries if none exist
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM public.admin_transactions) THEN
        INSERT INTO public.admin_transactions (amount, type, category, description, date, status, created_at)
        VALUES 
            (299.00, 'income', 'Langganan', 'Bayaran langganan - Plan Pro', CURRENT_DATE - INTERVAL '10 days', 'completed', NOW()),
            (299.00, 'income', 'Langganan', 'Bayaran langganan - Plan Pro', CURRENT_DATE - INTERVAL '40 days', 'completed', NOW());
        RAISE NOTICE 'Created sample admin transactions';
    ELSE
        RAISE NOTICE 'Admin transactions already exist';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Fix RLS policies for organizer_transactions
-- ============================================================================

-- Enable RLS
ALTER TABLE public.organizer_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin full access organizer_transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Organizer view own transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Organizer insert own transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Organizer update own transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Organizer delete own transactions" ON public.organizer_transactions;

-- Create policy for admin/superadmin to see ALL transactions
CREATE POLICY "Admin full access organizer_transactions"
    ON public.organizer_transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- Create policy for organizers to see only their own transactions
CREATE POLICY "Organizer view own transactions"
    ON public.organizer_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE organizers.id = organizer_transactions.organizer_id
            AND organizers.profile_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 6: Final verification
-- ============================================================================
SELECT 
    'FINAL COUNT' as check_type,
    COUNT(*) as total_transactions
FROM public.organizer_transactions;

SELECT 
    o.name,
    o.organizer_code,
    COUNT(ot.id) as tx_count,
    SUM(CASE WHEN ot.type = 'income' THEN ot.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN ot.type = 'expense' THEN ot.amount ELSE 0 END) as total_expense
FROM public.organizers o
LEFT JOIN public.organizer_transactions ot ON ot.organizer_id = o.id
GROUP BY o.id, o.name, o.organizer_code
ORDER BY tx_count DESC;
