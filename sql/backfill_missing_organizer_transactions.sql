-- Backfill missing organizer_transactions for existing approved tenant_payments
-- This ensures organizers see ALL their rent payments in their Akaun

-- 1. Find approved tenant_payments that don't have corresponding organizer_transactions
SELECT 
    tp.id as payment_id,
    tp.tenant_id,
    tp.organizer_id,
    tp.location_id,
    tp.amount,
    tp.payment_date,
    tp.billplz_id,
    tp.status,
    t.business_name as tenant_name,
    o.name as organizer_name
FROM public.tenant_payments tp
JOIN public.tenants t ON t.id = tp.tenant_id
LEFT JOIN public.organizers o ON o.id = tp.organizer_id
LEFT JOIN public.organizer_transactions ot ON ot.payment_reference = tp.billplz_id
WHERE tp.status = 'approved'
AND tp.organizer_id IS NOT NULL
AND ot.id IS NULL;

-- 2. Insert missing organizer_transactions
INSERT INTO public.organizer_transactions (
    organizer_id,
    tenant_id,
    location_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    is_auto_generated,
    is_sandbox,
    payment_reference
)
SELECT 
    tp.organizer_id,
    tp.tenant_id,
    tp.location_id,
    tp.amount,
    'income',
    'Sewa',
    'approved',
    COALESCE(tp.payment_date, CURRENT_DATE),
    'Bayaran Sewa dari: ' || COALESCE(t.business_name, t.full_name, 'Penyewa') || 
        ' (Kepada: ' || COALESCE(o.name, 'Organizer') || ') (Ref: ' || COALESCE(tp.billplz_id, 'Manual') || ')',
    tp.receipt_url,
    true,
    tp.is_sandbox,
    tp.billplz_id
FROM public.tenant_payments tp
JOIN public.tenants t ON t.id = tp.tenant_id
LEFT JOIN public.organizers o ON o.id = tp.organizer_id
LEFT JOIN public.organizer_transactions ot ON ot.payment_reference = tp.billplz_id
WHERE tp.status = 'approved'
AND tp.organizer_id IS NOT NULL
AND ot.id IS NULL;

-- 3. Also ensure tenant_transactions exist for these payments (expense side)
INSERT INTO public.tenant_transactions (
    tenant_id,
    profile_id,
    organizer_id,
    location_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    is_rent_payment,
    is_sandbox,
    payment_reference
)
SELECT 
    tp.tenant_id,
    t.profile_id,
    tp.organizer_id,
    tp.location_id,
    tp.amount,
    'expense',
    'Sewa',
    'approved',
    COALESCE(tp.payment_date, CURRENT_DATE),
    'Bayaran Sewa/Permit (Ref: ' || COALESCE(tp.billplz_id, 'Manual') || ')',
    tp.receipt_url,
    true,
    tp.is_sandbox,
    tp.billplz_id
FROM public.tenant_payments tp
JOIN public.tenants t ON t.id = tp.tenant_id
LEFT JOIN public.tenant_transactions tt ON tt.payment_reference = tp.billplz_id
WHERE tp.status = 'approved'
AND tt.id IS NULL;

-- 4. Verify organizer transactions for tenant_id 44's organizer
SELECT 
    'Organizer transactions for Kumim Sdn Bhd' as description,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM public.organizer_transactions
WHERE organizer_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
AND category = 'Sewa';

-- 5. Show sample organizer transactions
SELECT 
    id,
    description,
    amount,
    type,
    category,
    date,
    tenant_id
FROM public.organizer_transactions
WHERE organizer_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
ORDER BY date DESC
LIMIT 10;
