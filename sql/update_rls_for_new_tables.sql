-- =============================================================================
-- UPDATE RLS POLICIES TO USE NEW admins AND staff TABLES
-- This allows staff to see the same data as their linked admin
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS FOR RLS
-- =============================================================================

-- Function to get current user's organizer_code from admins or staff table
CREATE OR REPLACE FUNCTION public.get_user_organizer_code()
RETURNS text AS $$
DECLARE
    v_code text;
BEGIN
    -- Check staff table first
    SELECT organizer_code INTO v_code
    FROM public.staff
    WHERE profile_id = auth.uid();
    
    IF v_code IS NOT NULL THEN
        RETURN v_code;
    END IF;
    
    -- Then check admins table
    SELECT organizer_code INTO v_code
    FROM public.admins
    WHERE profile_id = auth.uid();
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.staff 
        WHERE profile_id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE profile_id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRANSACTIONS TABLE RLS UPDATE
-- =============================================================================

-- Drop existing policies that check profiles.organizer_code
DROP POLICY IF EXISTS "Staff view transactions via profiles" ON public.transactions;
DROP POLICY IF EXISTS "Admin view all transactions via profiles" ON public.transactions;

-- Create new policy: Staff can view transactions matching their organizer_code
CREATE POLICY "Staff view transactions via staff table" ON public.transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.profile_id = auth.uid()
            AND s.organizer_code = transactions.organizer_code
        )
    );

-- Create new policy: Admin can view all transactions in their organizer_code
CREATE POLICY "Admin view transactions via admins table" ON public.transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            WHERE a.profile_id = auth.uid()
            AND (a.organizer_code = transactions.organizer_code OR a.organizer_code IS NULL)
        )
    );

-- =============================================================================
-- TENANTS TABLE RLS UPDATE
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff view tenants via profiles" ON public.tenants;
DROP POLICY IF EXISTS "Admin view all tenants via profiles" ON public.tenants;

-- Staff can view tenants matching their organizer_code
CREATE POLICY "Staff view tenants via staff table" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.profile_id = auth.uid()
            AND s.organizer_code = tenants.organizer_code
        )
    );

-- Admin can view tenants in their organizer_code (or all if NULL)
CREATE POLICY "Admin view tenants via admins table" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            WHERE a.profile_id = auth.uid()
            AND (a.organizer_code = tenants.organizer_code OR a.organizer_code IS NULL)
        )
    );

-- =============================================================================
-- ORGANIZERS TABLE RLS UPDATE
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Staff view organizers via profiles" ON public.organizers;
DROP POLICY IF EXISTS "Admin view all organizers via profiles" ON public.organizers;

-- Staff can view their linked organizer
CREATE POLICY "Staff view organizers via staff table" ON public.organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.profile_id = auth.uid()
            AND s.organizer_code = organizers.organizer_code
        )
    );

-- Admin can view all organizers (or filtered by their organizer_code)
CREATE POLICY "Admin view organizers via admins table" ON public.organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            WHERE a.profile_id = auth.uid()
            AND (a.organizer_code = organizers.organizer_code OR a.organizer_code IS NULL)
        )
    );

-- =============================================================================
-- LOCATIONS TABLE RLS UPDATE
-- =============================================================================

-- Staff can view locations of their organizer
CREATE POLICY "Staff view locations via staff table" ON public.locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.organizers o ON o.organizer_code = s.organizer_code
            WHERE s.profile_id = auth.uid()
            AND o.id = locations.organizer_id
        )
    );

-- Admin can view locations of their organizer (or all)
CREATE POLICY "Admin view locations via admins table" ON public.locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            LEFT JOIN public.organizers o ON o.organizer_code = a.organizer_code
            WHERE a.profile_id = auth.uid()
            AND (a.organizer_code IS NULL OR o.id = locations.organizer_id)
        )
    );

-- =============================================================================
-- TENANT_LOCATIONS TABLE RLS UPDATE
-- =============================================================================

-- Staff can view tenant_locations of their organizer's tenants
CREATE POLICY "Staff view tenant_locations via staff table" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.tenants t ON t.organizer_code = s.organizer_code
            WHERE s.profile_id = auth.uid()
            AND t.id = tenant_locations.tenant_id
        )
    );

-- Admin can view tenant_locations of their organizer's tenants
CREATE POLICY "Admin view tenant_locations via admins table" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            JOIN public.tenants t ON t.organizer_code = a.organizer_code OR a.organizer_code IS NULL
            WHERE a.profile_id = auth.uid()
            AND t.id = tenant_locations.tenant_id
        )
    );

-- =============================================================================
-- TENANT_PAYMENTS TABLE RLS UPDATE
-- =============================================================================

-- Staff can view payments for tenants in their organizer
CREATE POLICY "Staff view payments via staff table" ON public.tenant_payments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.tenants t ON t.organizer_code = s.organizer_code
            WHERE s.profile_id = auth.uid()
            AND t.id = tenant_payments.tenant_id
        )
    );

-- Admin can view payments for tenants in their organizer
CREATE POLICY "Admin view payments via admins table" ON public.tenant_payments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            JOIN public.tenants t ON t.organizer_code = a.organizer_code OR a.organizer_code IS NULL
            WHERE a.profile_id = auth.uid()
            AND t.id = tenant_payments.tenant_id
        )
    );

-- =============================================================================
-- ACTION_LOGS TABLE RLS UPDATE
-- =============================================================================

-- Staff can view logs for their organizer
CREATE POLICY "Staff view logs via staff table" ON public.action_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s
            WHERE s.profile_id = auth.uid()
            AND s.organizer_code = action_logs.organizer_code
        )
    );

-- Admin can view logs for their organizer
CREATE POLICY "Admin view logs via admins table" ON public.action_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.admins a
            WHERE a.profile_id = auth.uid()
            AND (a.organizer_code = action_logs.organizer_code OR a.organizer_code IS NULL)
        )
    );

-- =============================================================================
-- VERIFY POLICIES
-- =============================================================================

SELECT 'RLS Policies Updated Successfully!' as status;

-- Show all policies for key tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual IS NOT NULL as has_using,
    with_check IS NOT NULL as has_with_check
FROM pg_policies 
WHERE tablename IN ('transactions', 'tenants', 'organizers', 'locations', 'staff', 'admins')
ORDER BY tablename, policyname;
