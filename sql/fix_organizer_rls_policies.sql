-- =============================================================================
-- FIX ORGANIZER RLS POLICIES
-- Ensure Organizers can only access their own data and their tenants' data
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION: Check if user is an organizer
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'organizer'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HELPER FUNCTION: Get organizer's organizer_code
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_organizer_code()
RETURNS text AS $$
DECLARE
    v_code text;
BEGIN
    SELECT organizer_code INTO v_code
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'organizer';
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ORGANIZERS TABLE - Organizers can only see their own record
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own record" ON public.organizers;

-- Organizers can only view their own organizer record (by profile_id match)
CREATE POLICY "Organizers view own record" ON public.organizers
    FOR SELECT TO authenticated
    USING (
        profile_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- LOCATIONS TABLE - Organizers can only see their own locations
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own locations" ON public.locations;

-- Organizers can view locations where organizer_id matches their organizer record
CREATE POLICY "Organizers view own locations" ON public.locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE o.id = locations.organizer_id
            AND o.profile_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- TENANTS TABLE - Organizers can only see tenants with their organizer_code
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own tenants" ON public.tenants;

-- Organizers can view tenants with matching organizer_code
CREATE POLICY "Organizers view own tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'organizer'
            AND p.organizer_code = tenants.organizer_code
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- TENANT_LOCATIONS TABLE - Organizers can see rentals at their locations
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own tenant locations" ON public.tenant_locations;

-- Organizers can view tenant_locations for their locations
CREATE POLICY "Organizers view own tenant locations" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.locations l
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE l.id = tenant_locations.location_id
            AND o.profile_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- TRANSACTIONS TABLE - Organizers can see transactions of their tenants
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own transactions" ON public.transactions;

-- Organizers can view transactions for tenants with their organizer_code
CREATE POLICY "Organizers view own transactions" ON public.transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = transactions.tenant_id
            AND p.role = 'organizer'
            AND p.organizer_code = t.organizer_code
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- TENANT_PAYMENTS TABLE - Organizers can see payments of their tenants
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own payments" ON public.tenant_payments;

-- Organizers can view payments for tenants with their organizer_code
CREATE POLICY "Organizers view own payments" ON public.tenant_payments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE t.id = tenant_payments.tenant_id
            AND p.role = 'organizer'
            AND p.organizer_code = t.organizer_code
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- ACTION_LOGS TABLE - Organizers can see their own logs
-- =============================================================================

-- Drop existing organizer policies
DROP POLICY IF EXISTS "Organizers view own logs" ON public.action_logs;

-- Organizers can view their own logs
CREATE POLICY "Organizers view own logs" ON public.action_logs
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'superadmin', 'staff')
        )
    );

-- =============================================================================
-- VERIFY POLICIES
-- =============================================================================

SELECT 'Organizer RLS Policies Updated Successfully!' as status;

-- Show all policies for organizer-related tables
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('organizers', 'locations', 'tenants', 'tenant_locations', 'transactions', 'tenant_payments', 'action_logs')
  AND policyname LIKE '%Organizer%'
ORDER BY tablename, policyname;
