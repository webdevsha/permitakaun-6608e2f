-- Verify Sejarah Bayaran will work for ALL tenants
-- This shows payment counts for all tenants in the system

-- 1. Count tenant_payments for ALL tenants
SELECT 
    'tenant_payments' as source,
    tenant_id,
    COUNT(*) as count
FROM public.tenant_payments
GROUP BY tenant_id
ORDER BY count DESC
LIMIT 20;

-- 2. Count rent-related tenant_transactions for ALL tenants
SELECT 
    'tenant_transactions (rent)' as source,
    tenant_id,
    COUNT(*) as count
FROM public.tenant_transactions
WHERE category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
GROUP BY tenant_id
ORDER BY count DESC
LIMIT 20;

-- 3. Combined view for all tenants
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email,
    COALESCE(tp.count, 0) as tenant_payments_count,
    COALESCE(tt.count, 0) as rent_transactions_count,
    COALESCE(tp.count, 0) + COALESCE(tt.count, 0) as total_sejarah_bayaran
FROM public.tenants t
LEFT JOIN (
    SELECT tenant_id, COUNT(*) as count 
    FROM public.tenant_payments 
    GROUP BY tenant_id
) tp ON tp.tenant_id = t.id
LEFT JOIN (
    SELECT tenant_id, COUNT(*) as count 
    FROM public.tenant_transactions 
    WHERE category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
    GROUP BY tenant_id
) tt ON tt.tenant_id = t.id
WHERE COALESCE(tp.count, 0) > 0 OR COALESCE(tt.count, 0) > 0
ORDER BY total_sejarah_bayaran DESC
LIMIT 30;

-- 4. Show tenant_id 44 specifically
SELECT 
    t.id as tenant_id,
    t.full_name,
    t.email,
    (SELECT COUNT(*) FROM public.tenant_payments WHERE tenant_id = t.id) as payments,
    (SELECT COUNT(*) FROM public.tenant_transactions WHERE tenant_id = t.id AND category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')) as rent_tx
FROM public.tenants t
WHERE t.id = 44;
