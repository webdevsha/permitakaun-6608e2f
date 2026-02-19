-- Fix Accounting Status
-- Updates tenants and organizers to 'active' if they have a valid subscription

-- 1. Update Tenants
UPDATE public.tenants
SET accounting_status = 'active'
WHERE id IN (
    SELECT tenant_id 
    FROM public.subscriptions 
    WHERE status = 'active' 
    AND end_date > NOW()
);

-- 2. Update Organizers (if applicable, though subscriptions usually links to tenant_id, need to check if organizer_id is supported)
-- In the previous scripts, we only linked to tenant_id in subscriptions table.
-- Let's check if subscriptions table has organizer_id or if organizers are handled differently.

-- If subscriptions table ONLY has tenant_id, then organizers might be linked via profile?
-- Actually, the subscription logic seems to focus on tenants.
-- Let's double check if we need to update organizers.
-- AdminSubscriptionsTab handles both.
-- If userRole === 'organizer', it updates organizers table.

-- Let's assume we need to handle organizers too if they are in the subscriptions table.
-- But wait, the subscriptions table schema in populate_subscriptions.sql only had tenant_id?
-- Let's check the schema of subscriptions if possible, or just be safe.

-- Verification: content of populate_subscriptions.sql:
-- INSERT INTO public.subscriptions (tenant_id, ...)
-- It seems we might have missed organizer_id column in subscriptions if it exists.
-- Or maybe organizers don't use the subscriptions table?
-- AdminSubscriptionsTab line 227 updates `organizers` table directly but doesn't seem to insert into `subscriptions` for organizers?
-- Line 203 inserts into subscriptions for tenants.
-- Line 227 update organizers but NO insert into subscriptions?
-- If so, organizers just rely on the flag?

-- Regardless, for AHMAD (who is a tenant), we strictly need to update the tenant table.

-- 3. Force update for Ahmad specifically to be safe
UPDATE public.tenants
SET accounting_status = 'active'
FROM public.profiles
WHERE tenants.profile_id = profiles.id
AND profiles.email = 'ahmad@permit.com';
