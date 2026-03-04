-- =============================================================================
-- Fix Subscription Plan Types
-- Run this in Supabase SQL Editor
-- =============================================================================

-- 1. Update the plan_type CHECK constraint to include new plan IDs
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check
  CHECK (plan_type IN ('basic', 'standard', 'premium', 'enterprise', 'sdn-bhd', 'sdn-bhd-berhad'));

-- 2. Add profile_id column so organizer subscriptions can be looked up by user
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES auth.users(id);

-- 3. Backfill existing subscriptions with correct plan type based on amount paid
--    RM 39 = Enterprise, RM 49 = Sdn Bhd
UPDATE subscriptions SET plan_type = 'enterprise' WHERE amount = 39 AND plan_type IN ('basic', 'standard', 'premium');
UPDATE subscriptions SET plan_type = 'sdn-bhd'    WHERE amount = 49 AND plan_type IN ('basic', 'standard', 'premium');

-- 4. Backfill profile_id for tenant subscriptions
UPDATE subscriptions s
SET profile_id = t.profile_id
FROM tenants t
WHERE s.tenant_id = t.id
  AND s.profile_id IS NULL;

-- 5. Backfill profile_id for organizer subscriptions via admin_transactions metadata
UPDATE subscriptions s
SET profile_id = (at.metadata->>'user_id')::uuid
FROM admin_transactions at
WHERE s.payment_ref = at.payment_reference
  AND s.tenant_id IS NULL
  AND s.profile_id IS NULL
  AND at.category = 'Langganan';

-- 6. Update RLS policy to allow users to see their own subscriptions (by tenant or profile_id)
--    and allow admins to see all
DROP POLICY IF EXISTS "Tenants can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
USING (
  tenant_id IN (SELECT id FROM tenants WHERE profile_id = auth.uid())
  OR profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Verify
SELECT id, tenant_id, profile_id, plan_type, status, amount, payment_ref
FROM subscriptions
ORDER BY created_at DESC
LIMIT 20;
