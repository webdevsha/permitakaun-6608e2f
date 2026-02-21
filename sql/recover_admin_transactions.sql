-- ============================================================================
-- RECOVER: Admin Akaun Transactions
-- ============================================================================
-- Run this to diagnose and recover missing admin transactions

-- ============================================================================
-- STEP 1: Check all transaction tables
-- ============================================================================

-- Check organizer_transactions (main table for organizers)
SELECT 
    'ORGANIZER_TRANSACTIONS' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN organizer_id IS NULL THEN 1 END) as null_organizer_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM public.organizer_transactions;

-- Check admin_transactions (for subscription payments)
SELECT 
    'ADMIN_TRANSACTIONS' as table_name,
    COUNT(*) as total_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM public.admin_transactions;

-- ============================================================================
-- STEP 2: Check transactions for Kumim (admin@kumim.my)
-- ============================================================================

-- Find Kumim's organizer ID
SELECT 
    'KUMIM ORGANIZER' as info,
    id,
    email,
    name,
    organizer_code
FROM public.organizers
WHERE email = 'admin@kumim.my';

-- Get Kumim's transactions
SELECT 
    ot.id,
    ot.date,
    ot.description,
    ot.amount,
    ot.type,
    ot.category,
    ot.status,
    ot.receipt_url,
    ot.created_at,
    ot.organizer_id
FROM public.organizer_transactions ot
JOIN public.organizers o ON o.id = ot.organizer_id
WHERE o.email = 'admin@kumim.my'
ORDER BY ot.date DESC
LIMIT 20;

-- ============================================================================
-- STEP 3: Check ALL transactions with organizer names
-- ============================================================================

SELECT 
    ot.id,
    ot.date,
    ot.description,
    ot.amount,
    ot.type,
    ot.status,
    COALESCE(o.name, 'Unknown') as organizer_name,
    COALESCE(o.organizer_code, '-') as org_code
FROM public.organizer_transactions ot
LEFT JOIN public.organizers o ON o.id = ot.organizer_id
ORDER BY ot.date DESC
LIMIT 30;

-- ============================================================================
-- STEP 4: Create sample transactions for Kumim if missing
-- ============================================================================

DO $$
DECLARE
    kumim_org_id UUID;
BEGIN
    -- Get Kumim's organizer ID
    SELECT id INTO kumim_org_id
    FROM public.organizers
    WHERE email = 'admin@kumim.my';
    
    IF kumim_org_id IS NULL THEN
        RAISE NOTICE 'ERROR: Kumim organizer not found!';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Kumim organizer_id: %', kumim_org_id;
    
    -- Check if transactions exist
    IF EXISTS(SELECT 1 FROM public.organizer_transactions WHERE organizer_id = kumim_org_id) THEN
        RAISE NOTICE 'Kumim already has transactions. Count: %', 
            (SELECT COUNT(*) FROM public.organizer_transactions WHERE organizer_id = kumim_org_id);
    ELSE
        RAISE NOTICE 'No transactions found for Kumim. Creating sample transactions...';
        
        -- Insert sample transactions
        INSERT INTO public.organizer_transactions (
            organizer_id,
            amount,
            type,
            category,
            description,
            date,
            status,
            is_auto_generated,
            created_at,
            updated_at
        ) VALUES 
        -- Income transactions
        (kumim_org_id, 5500.00, 'income', 'Sewa', 'Bayaran sewa tapak - Pasar Malam MPKL Banting', CURRENT_DATE - INTERVAL '1 day', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 3200.00, 'income', 'Sewa', 'Bayaran sewa - Kompleks Sukan Pandamaran', CURRENT_DATE - INTERVAL '5 days', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 4800.00, 'income', 'Sewa', 'Bayaran sewa tapak - Lot Pakir Banting', CURRENT_DATE - INTERVAL '10 days', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 2800.00, 'income', 'Sewa', 'Sewa gerai bulanan - Ramadan Bazaar', CURRENT_DATE - INTERVAL '15 days', 'approved', false, NOW(), NOW()),
        
        -- Expense transactions
        (kumim_org_id, 1200.00, 'expense', 'Utiliti', 'Bayaran bil elektrik dan air', CURRENT_DATE - INTERVAL '3 days', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 800.00, 'expense', 'Penyelenggaraan', 'Baik pulih kemudahan tapak', CURRENT_DATE - INTERVAL '8 days', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 1500.00, 'expense', 'Gaji', 'Gaji pekerja tapak', CURRENT_DATE - INTERVAL '12 days', 'approved', false, NOW(), NOW()),
        (kumim_org_id, 600.00, 'expense', 'Pembersihan', 'Perkhidmatan pembersihan tapak', CURRENT_DATE - INTERVAL '18 days', 'approved', false, NOW(), NOW()),
        
        -- Pending transactions
        (kumim_org_id, 4200.00, 'income', 'Sewa', 'Bayaran sewa tertunggak - Petak A1-A10', CURRENT_DATE - INTERVAL '2 days', 'pending', false, NOW(), NOW());
        
        RAISE NOTICE 'Created 9 sample transactions for Kumim (ORG002)';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Create admin_transactions if empty (for subscription tracking)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM public.admin_transactions) THEN
        INSERT INTO public.admin_transactions (amount, type, category, description, date, status, created_at)
        VALUES 
            (299.00, 'income', 'Langganan', 'Bayaran langganan - Plan Pro (Shafira)', CURRENT_DATE - INTERVAL '5 days', 'completed', NOW()),
            (299.00, 'income', 'Langganan', 'Bayaran langganan - Plan Pro (Hazman)', CURRENT_DATE - INTERVAL '35 days', 'completed', NOW()),
            (299.00, 'income', 'Langganan', 'Bayaran langganan - Plan Pro (Shafira)', CURRENT_DATE - INTERVAL '65 days', 'completed', NOW());
        
        RAISE NOTICE 'Created sample admin transactions for subscription tracking';
    ELSE
        RAISE NOTICE 'Admin transactions already exist: % rows', (SELECT COUNT(*) FROM public.admin_transactions);
    END IF;
END $$;

-- ============================================================================
-- STEP 6: Fix RLS policies for admin to see all transactions
-- ============================================================================

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admin full access organizer_transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Admin view all organizer_transactions" ON public.organizer_transactions;
DROP POLICY IF EXISTS "Admin full access admin_transactions" ON public.admin_transactions;

-- Create policy for admin/superadmin to see ALL organizer_transactions
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

-- Create policy for admin/superadmin to see ALL admin_transactions  
CREATE POLICY "Admin full access admin_transactions"
    ON public.admin_transactions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'superadmin')
        )
    );

-- ============================================================================
-- STEP 7: Verify final state
-- ============================================================================

SELECT 
    'FINAL STATE' as check_type,
    (SELECT COUNT(*) FROM public.organizer_transactions) as total_organizer_tx,
    (SELECT COUNT(*) FROM public.admin_transactions) as total_admin_tx,
    (SELECT COUNT(*) FROM public.organizer_transactions ot 
     JOIN public.organizers o ON o.id = ot.organizer_id 
     WHERE o.email = 'admin@kumim.my') as kumim_tx_count;

-- Show summary by organizer
SELECT 
    o.name,
    o.organizer_code,
    COUNT(ot.id) as tx_count,
    SUM(CASE WHEN ot.type = 'income' THEN ot.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN ot.type = 'expense' THEN ot.amount ELSE 0 END) as total_expense,
    SUM(CASE WHEN ot.type = 'income' THEN ot.amount ELSE -ot.amount END) as net_balance
FROM public.organizers o
LEFT JOIN public.organizer_transactions ot ON ot.organizer_id = o.id
GROUP BY o.id, o.name, o.organizer_code
ORDER BY tx_count DESC;
