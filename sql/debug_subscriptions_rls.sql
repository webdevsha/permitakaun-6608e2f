-- ============================================================================
-- DEBUG: Check what RLS policies exist on subscriptions and admin_transactions
-- Run this in Supabase SQL Editor to verify policies are applied
-- ============================================================================

-- 1. Check policies on subscriptions table
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'subscriptions'
ORDER BY policyname;

-- 2. Check policies on admin_transactions table
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_transactions'
ORDER BY policyname;

-- 3. Check if RLS is enabled on subscriptions
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'subscriptions';

-- 4. Check subscriptions table constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.subscriptions'::regclass;

-- 5. Check subscriptions data
SELECT id, tenant_id, plan_type, status, start_date, end_date, amount
FROM public.subscriptions
LIMIT 10;

-- 6. Check admin_transactions with Langganan category
SELECT id, description, amount, status, category, payment_reference,
       metadata->>'user_id' as user_id,
       metadata->>'user_role' as user_role,
       metadata->>'payer_email' as payer_email
FROM public.admin_transactions
WHERE category = 'Langganan'
LIMIT 10;
