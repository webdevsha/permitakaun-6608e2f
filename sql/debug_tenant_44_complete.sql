-- Complete diagnostic for tenant_id 44

-- 1. Tenant basic info
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email,
    t.profile_id,
    t.accounting_status,
    t.organizer_code,
    t.created_at
FROM public.tenants t
WHERE t.id = 44;

-- 2. Subscription info for tenant_id 44
SELECT 
    s.id as subscription_id,
    s.tenant_id,
    s.plan_type,
    s.status as subscription_status,
    s.start_date,
    s.end_date,
    s.created_at
FROM public.subscriptions s
WHERE s.tenant_id = 44
ORDER BY s.created_at DESC;

-- 3. All plan types in system
SELECT DISTINCT plan_type, status, COUNT(*) 
FROM public.subscriptions 
GROUP BY plan_type, status
ORDER BY plan_type, status;

-- 4. Check accounting_config if exists for this tenant's profile
SELECT 
    ac.profile_id,
    ac.percentages,
    ac.bank_names
FROM public.accounting_config ac
JOIN public.tenants t ON t.profile_id = ac.profile_id
WHERE t.id = 44;

-- 5. Expected behavior based on plan_type:
-- 'premium' -> Enterprise (3 tabungs: operating, tax, zakat)
-- 'standard' -> SdnBhd (4 tabungs: operating, tax, zakat, investment)  
-- 'basic' -> Full (7 tabungs: all)

-- 6. Fix: Update tenant_id 44 to have proper subscription if missing
-- Uncomment to apply fix:
/*
-- If no active subscription exists, create one for testing:
INSERT INTO public.subscriptions (tenant_id, plan_type, status, start_date, amount)
VALUES (44, 'premium', 'active', CURRENT_DATE, 99.00)
ON CONFLICT DO NOTHING;

-- Update tenant accounting_status to active
UPDATE public.tenants 
SET accounting_status = 'active'
WHERE id = 44;
*/
