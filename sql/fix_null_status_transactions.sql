-- Fix: Update NULL or empty status transactions to 'approved'
-- This ensures all transactions are visible in the Senarai Transaksi

-- First, check how many transactions have NULL or empty status
SELECT 
    'Before Fix' as status,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN status IS NULL OR status = '' THEN 1 ELSE 0 END) as null_or_empty_status,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
FROM public.tenant_transactions;

-- Fix: Update NULL or empty status to 'approved'
UPDATE public.tenant_transactions
SET status = 'approved',
    updated_at = NOW()
WHERE status IS NULL OR status = '';

-- Verify the fix
SELECT 
    'After Fix' as status,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN status IS NULL OR status = '' THEN 1 ELSE 0 END) as null_or_empty_status,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
FROM public.tenant_transactions;

-- Also check organizer_transactions for completeness
SELECT 
    'Organizer Transactions' as table_name,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN status IS NULL OR status = '' THEN 1 ELSE 0 END) as null_or_empty_status
FROM public.organizer_transactions;

-- Fix organizer_transactions too if needed
UPDATE public.organizer_transactions
SET status = 'approved',
    updated_at = NOW()
WHERE status IS NULL OR status = '';
