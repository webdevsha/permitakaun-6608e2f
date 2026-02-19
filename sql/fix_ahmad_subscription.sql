-- 1. Fix Ahmad's accounting status
UPDATE public.tenants
SET accounting_status = 'active'
FROM public.profiles
WHERE tenants.profile_id = profiles.id
AND profiles.email = 'ahmad@permit.com';

-- 2. Sync tenant_transactions status from admin_transactions
-- This updates any pending tenant transaction that has been approved by admin
UPDATE public.tenant_transactions
SET status = 'approved'
FROM public.admin_transactions
WHERE tenant_transactions.payment_reference = admin_transactions.payment_reference
AND admin_transactions.status = 'approved'
AND tenant_transactions.status != 'approved';

-- 3. Sync organizer_transactions status from admin_transactions
UPDATE public.organizer_transactions
SET status = 'approved'
FROM public.admin_transactions
WHERE organizer_transactions.payment_reference = admin_transactions.payment_reference
AND admin_transactions.status = 'approved'
AND organizer_transactions.status != 'approved';
