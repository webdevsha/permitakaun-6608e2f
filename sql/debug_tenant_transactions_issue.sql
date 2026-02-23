-- Diagnostic script for tenant transaction visibility issues
-- This checks for common problems that cause transactions not to appear

-- 1. Check transaction status distribution for tenant_id 44
SELECT 
    status,
    COUNT(*) as count,
    STRING_AGG(DISTINCT category, ', ') as categories
FROM public.tenant_transactions
WHERE tenant_id = 44
GROUP BY status;

-- 2. Check if transactions have NULL status (would be filtered out)
SELECT 
    id,
    description,
    category,
    status,
    type,
    amount,
    date,
    created_at
FROM public.tenant_transactions
WHERE tenant_id = 44
  AND (status IS NULL OR status = '')
ORDER BY date DESC;

-- 3. Check ALL transactions for tenant_id 44 with full details
SELECT 
    id,
    description,
    category,
    COALESCE(status, 'NULL') as status,
    type,
    amount,
    date::text,
    created_at::text,
    receipt_url IS NOT NULL as has_receipt
FROM public.tenant_transactions
WHERE tenant_id = 44
ORDER BY date DESC, created_at DESC
LIMIT 50;

-- 4. Check if tenant's profile_id matches the auth.uid()
-- (This is what RLS uses to filter)
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email as tenant_email,
    t.profile_id,
    p.email as profile_email,
    p.role,
    p.id as profile_uuid
FROM public.tenants t
LEFT JOIN public.profiles p ON t.profile_id = p.id
WHERE t.id = 44;

-- 5. Check for other tenants with similar missing transaction issues
SELECT 
    t.id as tenant_id,
    t.full_name,
    COUNT(tt.id) as total_transactions,
    SUM(CASE WHEN tt.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
    SUM(CASE WHEN tt.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN tt.status IS NULL OR tt.status = '' THEN 1 ELSE 0 END) as null_status_count,
    SUM(CASE WHEN tt.category = 'Langganan' THEN 1 ELSE 0 END) as langganan_count
FROM public.tenants t
LEFT JOIN public.tenant_transactions tt ON t.id = tt.tenant_id
GROUP BY t.id, t.full_name
HAVING COUNT(tt.id) > 0
ORDER BY null_status_count DESC, approved_count ASC;

-- 6. Check the actual status values in tenant_transactions
SELECT DISTINCT status, COUNT(*) 
FROM public.tenant_transactions 
GROUP BY status 
ORDER BY count DESC;

-- 7. Fix: Update any NULL status transactions to 'approved' for tenant_id 44
-- (Run this only if you confirm NULL statuses exist)
/*
UPDATE public.tenant_transactions
SET status = 'approved'
WHERE tenant_id = 44
  AND (status IS NULL OR status = '');
*/
