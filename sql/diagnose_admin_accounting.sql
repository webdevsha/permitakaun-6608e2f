-- ============================================================================
-- DIAGNOSE: Admin Accounting Data Issue
-- ============================================================================
-- Run this to check why admin@kumim.my sees empty Akaun data

-- 1. Check admin's profile and role
SELECT 
    'ADMIN PROFILE' as check_type,
    p.id,
    p.email,
    p.role,
    p.organizer_code,
    p.full_name
FROM public.profiles p
WHERE p.email = 'admin@kumim.my';

-- 2. Check admin entry in admins table
SELECT 
    'ADMINS TABLE' as check_type,
    a.id,
    a.profile_id,
    a.email,
    a.organizer_code,
    a.full_name
FROM public.admins a
WHERE a.email = 'admin@kumim.my';

-- 3. Check organizer record for admin
SELECT 
    'ORGANIZER RECORD' as check_type,
    o.id,
    o.profile_id,
    o.email,
    o.organizer_code,
    o.name,
    o.status
FROM public.organizers o
WHERE o.email = 'admin@kumim.my';

-- 4. Count transactions for this organizer
SELECT 
    'TRANSACTIONS COUNT' as check_type,
    COUNT(*) as count
FROM public.organizer_transactions ot
JOIN public.organizers o ON o.id = ot.organizer_id
WHERE o.email = 'admin@kumim.my';

-- 5. Show sample transactions if any exist
SELECT 
    'SAMPLE TRANSACTIONS' as check_type,
    ot.id,
    ot.date,
    ot.description,
    ot.amount,
    ot.type,
    ot.status,
    o.name as organizer_name,
    o.organizer_code
FROM public.organizer_transactions ot
JOIN public.organizers o ON o.id = ot.organizer_id
WHERE o.email = 'admin@kumim.my'
ORDER BY ot.date DESC
LIMIT 5;

-- 6. Check all transactions in organizer_transactions
SELECT 
    'ALL ORGANIZER TRANSACTIONS' as check_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN organizer_id IS NULL THEN 1 END) as null_organizer_count
FROM public.organizer_transactions;

-- 7. Check if admin_transactions table has data
SELECT 
    'ADMIN TRANSACTIONS' as check_type,
    COUNT(*) as count
FROM public.admin_transactions;

-- 8. Show organizer_transactions by organizer
SELECT 
    o.name,
    o.organizer_code,
    COUNT(ot.id) as tx_count
FROM public.organizers o
LEFT JOIN public.organizer_transactions ot ON ot.organizer_id = o.id
GROUP BY o.id, o.name, o.organizer_code
ORDER BY tx_count DESC;

-- 9. Check RLS policies on organizer_transactions
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'organizer_transactions';

-- 10. Check if user can see all transactions (as postgres)
SELECT 
    'VISIBLE TRANSACTIONS' as check_type,
    COUNT(*) as count
FROM public.organizer_transactions;
