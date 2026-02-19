-- Populate subscriptions table from admin_transactions
-- This ensures that users who have paid (according to admin_transactions) have a valid subscription record

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
SELECT 
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
JOIN public.profiles p ON (at.metadata->>'user_id')::uuid = p.id
JOIN public.tenants t ON t.profile_id = p.id
WHERE at.category = 'Langganan'
AND at.status = 'approved'
AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s 
    WHERE s.payment_ref = at.payment_reference
);
