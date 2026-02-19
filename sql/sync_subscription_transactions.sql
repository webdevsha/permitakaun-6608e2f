-- Sync script: Copy missing 'Langganan' transactions from admin_transactions to user transaction tables

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
SELECT 
    t.id as tenant_id,
    at.description,
    at.amount,
    'expense' as type, -- It is an expense for the tenant
    'Langganan' as category,
    at.date,
    at.status,
    at.payment_method,
    at.payment_reference,
    at.receipt_url,
    at.notes,
    at.created_at,
    at.updated_at
FROM public.admin_transactions at
JOIN public.profiles p ON (at.metadata->>'user_id')::uuid = p.id
JOIN public.tenants t ON t.profile_id = p.id
WHERE at.category = 'Langganan' 
AND at.type = 'income' -- It is income for admin
AND NOT EXISTS (
    -- Check if it already exists in tenant_transactions
    SELECT 1 FROM public.tenant_transactions tt 
    WHERE tt.payment_reference = at.payment_reference
    OR (tt.amount = at.amount AND tt.date = at.date AND tt.category = 'Langganan')
);

-- 2. Sync for Organizers
INSERT INTO public.organizer_transactions (
    organizer_id,
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
    o.id as organizer_id,
    at.description,
    at.amount,
    'expense' as type,
    'Langganan' as category,
    at.date,
    at.status,
    at.payment_method,
    at.payment_reference,
    at.receipt_url,
    at.notes,
    at.created_at,
    at.updated_at
FROM public.admin_transactions at
JOIN public.profiles p ON (at.metadata->>'user_id')::uuid = p.id
JOIN public.organizers o ON o.profile_id = p.id
WHERE at.category = 'Langganan' 
AND at.type = 'income'
AND NOT EXISTS (
    SELECT 1 FROM public.organizer_transactions ot 
    WHERE ot.payment_reference = at.payment_reference
    OR (ot.amount = at.amount AND ot.date = at.date AND ot.category = 'Langganan')
);
