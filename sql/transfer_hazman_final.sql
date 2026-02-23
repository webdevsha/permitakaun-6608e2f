-- Final script to transfer Hazman's transactions
-- First check what columns actually exist

-- Check admin_transactions columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'admin_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Based on common columns, here's the corrected transfer:

-- Transfer from organizer_transactions (if any) to admin_transactions
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
    jsonb_build_object('source', 'organizer_transactions', 'original_id', ot.id),
    ot.created_at,
    ot.updated_at
FROM public.organizer_transactions ot
WHERE ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- Transfer from tenant_transactions (if any) to admin_transactions
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
    tt.is_rent_payment,
    jsonb_build_object('source', 'tenant_transactions', 'original_id', tt.id),
    tt.created_at,
    tt.updated_at
FROM public.tenant_transactions tt
WHERE tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT COUNT(*) as total_hazman_transactions 
FROM public.admin_transactions 
WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';
