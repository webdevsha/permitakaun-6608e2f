-- Transfer all Hazman-related transactions to admin_transactions
-- Hazman's profile_id: 2c9f0478-cc40-4f89-928f-c5a9180e7b87

-- 1. Check what transactions exist for Hazman in other tables

-- From organizer_transactions (where Hazman might have been an organizer)
SELECT 
    'organizer_transactions' as source_table,
    COUNT(*) as count
FROM public.organizer_transactions ot
WHERE ot.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
OR ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
);

-- From tenant_transactions (where Hazman might have been a tenant)
SELECT 
    'tenant_transactions' as source_table,
    COUNT(*) as count
FROM public.tenant_transactions tt
WHERE tt.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
OR tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
);

-- 2. Transfer from organizer_transactions to admin_transactions
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
WHERE ot.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
OR ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- 3. Transfer from tenant_transactions to admin_transactions
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
WHERE tt.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
OR tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- 4. Verify the transfer
SELECT 
    'Total admin_transactions for Hazman' as description,
    COUNT(*) as count
FROM public.admin_transactions
WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';

-- 5. Show sample of transferred transactions
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
