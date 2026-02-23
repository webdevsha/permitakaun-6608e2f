-- Debug script for tenant_id 44 transaction visibility issue
-- Run this in Supabase SQL Editor

-- 1. Check tenant_id 44 details
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email,
    t.profile_id,
    t.organizer_code,
    p.role as profile_role,
    p.email as profile_email
FROM public.tenants t
LEFT JOIN public.profiles p ON t.profile_id = p.id
WHERE t.id = 44;

-- 2. Check ALL transactions for tenant_id 44 (including Langganan)
SELECT 
    tt.id,
    tt.tenant_id,
    tt.amount,
    tt.type,
    tt.category,
    tt.status,
    tt.date,
    tt.description,
    tt.created_at
FROM public.tenant_transactions tt
WHERE tt.tenant_id = 44
ORDER BY tt.date DESC, tt.created_at DESC;

-- 3. Check transactions by category for tenant_id 44
SELECT 
    category,
    COUNT(*) as count,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
FROM public.tenant_transactions
WHERE tenant_id = 44
GROUP BY category
ORDER BY count DESC;

-- 4. Check if profile_id is NULL for any transactions
SELECT 
    COUNT(*) as total_transactions,
    SUM(CASE WHEN profile_id IS NULL THEN 1 ELSE 0 END) as null_profile_count,
    SUM(CASE WHEN profile_id IS NOT NULL THEN 1 ELSE 0 END) as with_profile_count
FROM public.tenant_transactions
WHERE tenant_id = 44;

-- 5. Check RLS policy simulation for tenant_id 44's profile
-- This simulates what the RLS policy would return
SELECT 
    tt.*,
    t.profile_id as tenant_profile_id,
    auth.uid() as current_user_id  -- This will show the currently logged-in user
FROM public.tenant_transactions tt
JOIN public.tenants t ON tt.tenant_id = t.id
WHERE tt.tenant_id = 44
  AND t.profile_id = auth.uid();  -- RLS check

-- 6. Check if there are other tenants with similar issues
SELECT 
    t.id as tenant_id,
    t.full_name,
    COUNT(tt.id) as total_transactions,
    SUM(CASE WHEN tt.category = 'Langganan' THEN 1 ELSE 0 END) as langganan_count,
    SUM(CASE WHEN tt.category != 'Langganan' THEN 1 ELSE 0 END) as other_count
FROM public.tenants t
LEFT JOIN public.tenant_transactions tt ON t.id = tt.tenant_id
GROUP BY t.id, t.full_name
HAVING COUNT(tt.id) > 0
ORDER BY other_count ASC;
