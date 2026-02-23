-- Transfer all Hazman-related transactions to admin_transactions
-- First check what organizer_id and tenant_id Hazman has

-- 1. Get Hazman's organizer_id (if he has one)
SELECT o.id as organizer_id, o.profile_id, o.name
FROM public.organizers o
WHERE o.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';

-- 2. Get Hazman's tenant_id (if he has one)
SELECT t.id as tenant_id, t.profile_id, t.full_name
FROM public.tenants t
WHERE t.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';

-- 3. Check organizer_transactions by organizer_id
SELECT 
    'organizer_transactions' as source_table,
    COUNT(*) as count
FROM public.organizer_transactions ot
WHERE ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
);

-- 4. Check tenant_transactions by tenant_id
SELECT 
    'tenant_transactions' as source_table,
    COUNT(*) as count
FROM public.tenant_transactions tt
WHERE tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
);

-- 5. Transfer from organizer_transactions (if any) to admin_transactions
-- Note: organizer_transactions uses organizer_id, not profile_id
INSERT INTO public.admin_transactions (
    profile_id,
    admin_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    payment_reference,
    is_auto_generated,
    metadata,
    created_at,
    updated_at
)
SELECT 
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87' as profile_id,
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87' as admin_id,
    ot.amount,
    ot.type,
    ot.category,
    ot.status,
    ot.date,
    ot.description,
    ot.receipt_url,
    ot.payment_reference,
    ot.is_auto_generated,
    jsonb_build_object('source', 'organizer_transactions', 'original_id', ot.id, 'original_organizer_id', ot.organizer_id),
    ot.created_at,
    ot.updated_at
FROM public.organizer_transactions ot
WHERE ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- 6. Transfer from tenant_transactions (if any) to admin_transactions
-- Note: tenant_transactions uses tenant_id, not profile_id
INSERT INTO public.admin_transactions (
    profile_id,
    admin_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    payment_reference,
    is_auto_generated,
    is_rent_payment,
    metadata,
    created_at,
    updated_at
)
SELECT 
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87' as profile_id,
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87' as admin_id,
    tt.amount,
    tt.type,
    tt.category,
    tt.status,
    tt.date,
    tt.description,
    tt.receipt_url,
    tt.payment_reference,
    tt.is_auto_generated,
    tt.is_rent_payment,
    jsonb_build_object('source', 'tenant_transactions', 'original_id', tt.id, 'original_tenant_id', tt.tenant_id),
    tt.created_at,
    tt.updated_at
FROM public.tenant_transactions tt
WHERE tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- 7. Verify the transfer
SELECT 
    'Total admin_transactions for Hazman' as description,
    COUNT(*) as count
FROM public.admin_transactions
WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';

-- 8. Show sample of all transactions
SELECT 
    id,
    description,
    amount,
    type,
    category,
    date,
    metadata->>'source' as original_source
FROM public.admin_transactions
WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
ORDER BY date DESC
LIMIT 20;
