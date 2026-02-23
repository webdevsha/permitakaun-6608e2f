-- Debug tenant_id 44 subscription and plan details

-- 1. Check tenant basic info
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email,
    t.profile_id,
    t.accounting_status,
    t.organizer_code
FROM public.tenants t
WHERE t.id = 44;

-- 2. Check subscription details for tenant_id 44
SELECT 
    s.id as subscription_id,
    s.tenant_id,
    s.plan_type,
    s.status,
    s.created_at,
    s.start_date,
    s.end_date
FROM public.subscriptions s
WHERE s.tenant_id = 44
ORDER BY s.created_at DESC
LIMIT 5;

-- 3. Check what plan_type values exist in subscriptions
SELECT DISTINCT plan_type, COUNT(*) 
FROM public.subscriptions 
GROUP BY plan_type;

-- 4. Check if tenant_id 44 has any transactions
SELECT 
    COUNT(*) as total_transactions,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
FROM public.tenant_transactions
WHERE tenant_id = 44;

-- 5. Check profile details for tenant_id 44
SELECT 
    p.id,
    p.email,
    p.role,
    p.full_name
FROM public.profiles p
JOIN public.tenants t ON t.profile_id = p.id
WHERE t.id = 44;
