-- Safe transfer script - only uses common columns

-- First, let's see what columns are common across tables
WITH admin_cols AS (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'admin_transactions' AND table_schema = 'public'
),
org_cols AS (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'organizer_transactions' AND table_schema = 'public'
),
tenant_cols AS (
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'tenant_transactions' AND table_schema = 'public'
)
SELECT 'admin_transactions' as table_name, column_name FROM admin_cols
UNION ALL
SELECT 'organizer_transactions', column_name FROM org_cols
UNION ALL
SELECT 'tenant_transactions', column_name FROM tenant_cols
ORDER BY 1, 2;

-- Simple transfer using only standard columns
-- From organizer_transactions
INSERT INTO public.admin_transactions (
    profile_id,
    admin_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    created_at,
    updated_at
)
SELECT 
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    ot.amount,
    ot.type,
    ot.category,
    ot.status,
    ot.date,
    ot.description,
    ot.created_at,
    ot.updated_at
FROM public.organizer_transactions ot
WHERE ot.organizer_id IN (
    SELECT id FROM public.organizers WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- From tenant_transactions
INSERT INTO public.admin_transactions (
    profile_id,
    admin_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    created_at,
    updated_at
)
SELECT 
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    tt.amount,
    tt.type,
    tt.category,
    tt.status,
    tt.date,
    tt.description,
    tt.created_at,
    tt.updated_at
FROM public.tenant_transactions tt
WHERE tt.tenant_id IN (
    SELECT id FROM public.tenants WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- Show results
SELECT COUNT(*) as hazman_total FROM public.admin_transactions WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';
