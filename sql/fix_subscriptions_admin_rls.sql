-- ============================================================================
-- FIX: Admin/Staff RLS policies for subscriptions + admin_transactions
--
-- Uses is_admin() / is_staff() SECURITY DEFINER functions (from fix_admin_rls_final.sql)
-- instead of inline EXISTS on profiles, which gets blocked by nested RLS.
-- ============================================================================

-- ============================================================================
-- STEP 0: Ensure helper functions exist (SECURITY DEFINER bypasses nested RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'staff'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 1: subscriptions table — admin/staff full access
-- ============================================================================

DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.subscriptions;

CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
    FOR ALL TO authenticated
    USING (public.is_admin() OR public.is_staff())
    WITH CHECK (public.is_admin() OR public.is_staff());

-- Extend status constraint to allow 'cancelled' (admin UI counts it)
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'expired', 'payment_pending', 'cancelled'));

-- ============================================================================
-- STEP 2: admin_transactions table — re-ensure admin full access
-- ============================================================================

DROP POLICY IF EXISTS "Admin full access admin_transactions" ON public.admin_transactions;
DROP POLICY IF EXISTS "Admins view admin transactions" ON public.admin_transactions;
DROP POLICY IF EXISTS "Admins insert admin transactions" ON public.admin_transactions;
DROP POLICY IF EXISTS "Admins update admin transactions" ON public.admin_transactions;
DROP POLICY IF EXISTS "Staff view admin transactions" ON public.admin_transactions;
DROP POLICY IF EXISTS "Organizer view own admin_transactions" ON public.admin_transactions;

-- Admin full access
CREATE POLICY "Admin full access admin_transactions" ON public.admin_transactions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Staff read access
CREATE POLICY "Staff view admin transactions" ON public.admin_transactions
    FOR SELECT TO authenticated
    USING (public.is_staff());

-- Organizer view own subscription records
CREATE POLICY "Organizer view own admin_transactions" ON public.admin_transactions
    FOR SELECT TO authenticated
    USING (
        metadata->>'user_id' = auth.uid()::text
        AND metadata->>'user_role' = 'organizer'
    );

-- ============================================================================
-- STEP 3: Backfill user_role in existing admin_transactions metadata
-- ============================================================================

UPDATE public.admin_transactions at_record
SET metadata = at_record.metadata || jsonb_build_object(
    'user_role', p.role
)
FROM public.profiles p
WHERE at_record.category = 'Langganan'
  AND at_record.metadata->>'user_id' IS NOT NULL
  AND at_record.metadata->>'user_role' IS NULL
  AND p.id = (at_record.metadata->>'user_id')::uuid;

SELECT 'Fixed with SECURITY DEFINER functions — admin can now see subscriptions + admin_transactions' AS status;
