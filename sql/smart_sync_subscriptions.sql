-- Smart Sync Subscriptions
-- Matches admin_transactions to tenants/organizers using multiple strategies
-- 1. metadata->>'user_id' (Standard)
-- 2. metadata->>'payer_email' (Fallback)
-- 3. Description contains email (Deep Fallback)

-- 1. Sync for Tenants
INSERT INTO public.tenant_transactions (
    tenant_id,
    description,
    amount,
    type,
    category,
    date,
    status,
    payment_method,
    payment_reference,
    receipt_url,
    notes,
    created_at,
    updated_at
)
SELECT DISTINCT ON (at.id)
    t.id as tenant_id,
    at.description,
    at.amount,
    'expense',
    'Langganan',
    at.date,
    at.status,
    at.payment_method,
    at.payment_reference,
    at.receipt_url,
    at.notes,
    at.created_at,
    at.updated_at
FROM public.admin_transactions at
-- Join Strategy 1: User ID
LEFT JOIN public.tenants t1 ON t1.profile_id = (at.metadata->>'user_id')::uuid
-- Join Strategy 2: Email in Metadata
LEFT JOIN public.tenants t2 ON t2.email = (at.metadata->>'payer_email')
-- Join Strategy 3: Email in Description (regex extraction or like)
-- Doing a broader join here is expensive, so we'll rely on specific known emails or exact matches if possible.
-- For now, let's rely on t1 and t2.
CROSS JOIN LATERAL (
    SELECT COALESCE(t1.id, t2.id) as id
) t
WHERE at.category = 'Langganan' 
AND at.type = 'income'
AND t.id IS NOT NULL -- Must have found a tenant
AND NOT EXISTS (
    SELECT 1 FROM public.tenant_transactions tt 
    WHERE tt.payment_reference = at.payment_reference
    OR (tt.amount = at.amount AND tt.date = at.date AND tt.category = 'Langganan')
);

-- 2. Populate Subscriptions Table (Smart Sync)
INSERT INTO public.subscriptions (
    tenant_id,
    plan_type,
    status,
    start_date,
    end_date,
    amount,
    payment_ref,
    created_at,
    updated_at
)
SELECT DISTINCT ON (at.id)
    t.id as tenant_id,
    COALESCE(at.metadata->>'plan_type', 'basic') as plan_type,
    'active' as status,
    at.date as start_date,
    (at.date + INTERVAL '30 days') as end_date,
    at.amount,
    at.payment_reference,
    at.created_at,
    at.updated_at
FROM public.admin_transactions at
LEFT JOIN public.tenants t1 ON t1.profile_id = (at.metadata->>'user_id')::uuid
LEFT JOIN public.tenants t2 ON t2.email = (at.metadata->>'payer_email')
CROSS JOIN LATERAL (
    SELECT COALESCE(t1.id, t2.id) as id
) t
WHERE at.category = 'Langganan'
AND at.status = 'approved'
AND t.id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s 
    WHERE s.payment_ref = at.payment_reference
);

-- 3. Specific Fix for transaction 1234454FB5616612 (if it exists and still fails)
-- We'll try to update the metadata for this specific transaction if it lacks user_id but we know it's Ahmad
UPDATE public.admin_transactions
SET metadata = jsonb_build_object(
    'user_id', (SELECT id FROM profiles WHERE email = 'ahmad@permit.com'),
    'payer_email', 'ahmad@permit.com',
    'plan_type', 'basic',
    'is_subscription', true
) || COALESCE(metadata, '{}'::jsonb)
WHERE payment_reference = '1234454FB5616612'
AND (metadata->>'user_id') IS NULL;

-- 4. Re-run sync specifically for this transaction after metadata fix
INSERT INTO public.tenant_transactions (
    tenant_id,
    description,
    amount,
    type,
    category,
    date,
    status,
    payment_method,
    payment_reference,
    receipt_url,
    notes,
    created_at,
    updated_at
)
SELECT 
    t.id,
    at.description,
    at.amount,
    'expense',
    'Langganan',
    at.date,
    at.status,
    at.payment_method,
    at.payment_reference,
    at.receipt_url,
    at.notes,
    at.created_at,
    at.updated_at
FROM public.admin_transactions at
JOIN public.tenants t ON t.email = 'ahmad@permit.com'
WHERE at.payment_reference = '1234454FB5616612'
AND NOT EXISTS (
    SELECT 1 FROM public.tenant_transactions tt 
    WHERE tt.payment_reference = at.payment_reference
);
