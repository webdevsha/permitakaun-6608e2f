-- ============================================================================
-- COMPREHENSIVE RLS FIX FOR ADMIN ACCESS
-- Fixes: RLS violations, data visibility for admin@kumim.my, staff linking
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop existing problematic policies
-- ============================================================================

-- Drop location policies
DROP POLICY IF EXISTS "Locations: Admin/Staff read access" ON locations;
DROP POLICY IF EXISTS "Locations: Staff create access" ON locations;
DROP POLICY IF EXISTS "Locations: Staff update access" ON locations;
DROP POLICY IF EXISTS "Locations: Admin full access" ON locations;

-- Drop tenant policies
DROP POLICY IF EXISTS "Tenants: Admin/Staff read access" ON tenants;
DROP POLICY IF EXISTS "Tenants: Admin/Staff create access" ON tenants;
DROP POLICY IF EXISTS "Tenants: Admin/Staff update access" ON tenants;
DROP POLICY IF EXISTS "Tenants: Admin full access" ON tenants;
DROP POLICY IF EXISTS "Tenants: Tenant self access" ON tenants;

-- Drop organizer policies
DROP POLICY IF EXISTS "Organizers: Admin/Staff read access" ON organizers;
DROP POLICY IF EXISTS "Organizers: Admin/Staff create access" ON organizers;
DROP POLICY IF EXISTS "Organizers: Admin/Staff update access" ON organizers;
DROP POLICY IF EXISTS "Organizers: Admin full access" ON organizers;

-- Drop profile policies
DROP POLICY IF EXISTS "Profiles: Admin/Staff read access" ON profiles;
DROP POLICY IF EXISTS "Profiles: Admin/Staff update access" ON profiles;
DROP POLICY IF EXISTS "Profiles: Admin full access" ON profiles;
DROP POLICY IF EXISTS "Profiles: Users read own" ON profiles;
DROP POLICY IF EXISTS "Profiles: Users update own" ON profiles;

-- Drop transaction policies
DROP POLICY IF EXISTS "Transactions: Admin/Staff read access" ON organizer_transactions;
DROP POLICY IF EXISTS "Transactions: Admin/Staff create access" ON organizer_transactions;
DROP POLICY IF EXISTS "Transactions: Admin/Staff update access" ON organizer_transactions;
DROP POLICY IF EXISTS "Transactions: Admin full access" ON organizer_transactions;
DROP POLICY IF EXISTS "Admin view admin transactions" ON admin_transactions;
DROP POLICY IF EXISTS "Admins view admin transactions" ON admin_transactions;
DROP POLICY IF EXISTS "Admins insert admin transactions" ON admin_transactions;
DROP POLICY IF EXISTS "Admins update admin transactions" ON admin_transactions;

-- Drop tenant_payments policies
DROP POLICY IF EXISTS "Tenant Payments: Admin/Staff read access" ON tenant_payments;
DROP POLICY IF EXISTS "Tenant Payments: Admin full access" ON tenant_payments;

-- ============================================================================
-- STEP 2: Create helper function for checking admin role
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
-- STEP 3: LOCATIONS - Admin/Staff Full Access
-- ============================================================================

-- Admin/Superadmin: Full access to ALL locations
CREATE POLICY "Locations: Admin Full Access"
ON public.locations
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Read access to ALL locations (mirrors admin view)
CREATE POLICY "Locations: Staff Read All"
ON public.locations
FOR SELECT
USING (public.is_staff());

-- Staff: Can create locations (goes to pending)
CREATE POLICY "Locations: Staff Create"
ON public.locations
FOR INSERT
WITH CHECK (public.is_staff());

-- Staff: Can update locations (goes to pending approval for changes)
CREATE POLICY "Locations: Staff Update"
ON public.locations
FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Staff: Can delete locations
CREATE POLICY "Locations: Staff Delete"
ON public.locations
FOR DELETE
USING (public.is_staff());

-- Organizer: Access to their own locations via organizer_id
CREATE POLICY "Locations: Organizer Own"
ON public.locations
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.organizers
        WHERE organizers.id = locations.organizer_id
        AND organizers.profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organizers
        WHERE organizers.id = locations.organizer_id
        AND organizers.profile_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 4: TENANTS - Admin/Staff Full Access
-- ============================================================================

-- Drop existing
DROP POLICY IF EXISTS "Tenants: Admin Full Access" ON public.tenants;
DROP POLICY IF EXISTS "Tenants: Staff Full Access" ON public.tenants;
DROP POLICY IF EXISTS "Tenants: Self Access" ON public.tenants;

-- Admin/Superadmin: Full access
CREATE POLICY "Tenants: Admin Full Access"
ON public.tenants
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Full access to ALL tenants (mirrors admin)
CREATE POLICY "Tenants: Staff Full Access"
ON public.tenants
FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Tenant: Access to own record via profile_id
CREATE POLICY "Tenants: Self Access"
ON public.tenants
FOR ALL
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- ============================================================================
-- STEP 5: ORGANIZERS - Admin/Staff Full Access
-- ============================================================================

-- Drop existing
DROP POLICY IF EXISTS "Organizers: Admin Full Access" ON public.organizers;
DROP POLICY IF EXISTS "Organizers: Staff Full Access" ON public.organizers;
DROP POLICY IF EXISTS "Organizers: Self Access" ON public.organizers;

-- Admin/Superadmin: Full access
CREATE POLICY "Organizers: Admin Full Access"
ON public.organizers
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Full access to ALL organizers (mirrors admin)
CREATE POLICY "Organizers: Staff Full Access"
ON public.organizers
FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Organizer: Access to own record
CREATE POLICY "Organizers: Self Access"
ON public.organizers
FOR ALL
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- ============================================================================
-- STEP 6: PROFILES - Admin/Staff Full Access
-- ============================================================================

-- Drop existing
DROP POLICY IF EXISTS "Profiles: Admin Full Access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Staff Read All" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Staff Update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Self Read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Self Update" ON public.profiles;

-- Admin/Superadmin: Full access to ALL profiles
CREATE POLICY "Profiles: Admin Full Access"
ON public.profiles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Read access to all profiles
CREATE POLICY "Profiles: Staff Read All"
ON public.profiles
FOR SELECT
USING (public.is_staff());

-- Staff: Can update profiles (for their organization)
CREATE POLICY "Profiles: Staff Update"
ON public.profiles
FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Everyone: Can read own profile
CREATE POLICY "Profiles: Self Read"
ON public.profiles
FOR SELECT
USING (id = auth.uid());

-- Everyone: Can update own profile (except role)
CREATE POLICY "Profiles: Self Update"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================================================
-- STEP 7: ORGANIZER TRANSACTIONS - Admin/Staff Full Access
-- ============================================================================

-- Admin/Superadmin: Full access
CREATE POLICY "Transactions: Admin Full Access"
ON public.organizer_transactions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Full access (mirrors admin)
CREATE POLICY "Transactions: Staff Full Access"
ON public.organizer_transactions
FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Tenant: Access to own transactions
CREATE POLICY "Transactions: Tenant Own"
ON public.organizer_transactions
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.tenants
        WHERE tenants.id = organizer_transactions.tenant_id
        AND tenants.profile_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 8: TENANT PAYMENTS - Admin/Staff Full Access
-- ============================================================================

-- Drop existing
DROP POLICY IF EXISTS "Tenant Payments: Admin Full Access" ON public.tenant_payments;
DROP POLICY IF EXISTS "Tenant Payments: Staff Full Access" ON public.tenant_payments;
DROP POLICY IF EXISTS "Tenant Payments: Tenant Own" ON public.tenant_payments;

-- Admin/Superadmin: Full access
CREATE POLICY "Tenant Payments: Admin Full Access"
ON public.tenant_payments
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Full access
CREATE POLICY "Tenant Payments: Staff Full Access"
ON public.tenant_payments
FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Tenant: Access to own payments
CREATE POLICY "Tenant Payments: Tenant Own"
ON public.tenant_payments
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.tenants
        WHERE tenants.id = tenant_payments.tenant_id
        AND tenants.profile_id = auth.uid()
    )
);

-- ============================================================================
-- STEP 9: ACTION LOGS - Admin/Staff Full Access
-- ============================================================================

-- Drop existing
DROP POLICY IF EXISTS "Action Logs: Admin Full Access" ON public.action_logs;
DROP POLICY IF EXISTS "Action Logs: Staff Full Access" ON public.action_logs;
DROP POLICY IF EXISTS "Action Logs: Self Read" ON public.action_logs;

-- Admin/Superadmin: Full access
CREATE POLICY "Action Logs: Admin Full Access"
ON public.action_logs
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Staff: Full access
CREATE POLICY "Action Logs: Staff Full Access"
ON public.action_logs
FOR ALL
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Users: Can read their own logs
CREATE POLICY "Action Logs: Self Read"
ON public.action_logs
FOR SELECT
USING (user_id = auth.uid());

-- ============================================================================
-- STEP 10: FIX DATA - Ensure admin@kumim.my staff has correct organizer_code
-- ============================================================================

-- First, let's ensure Hazman (admin@kumim.my) has the correct organizer record
UPDATE public.organizers
SET 
    organizer_code = 'ORG002',
    name = 'Hazman Enterprise'
WHERE email = 'admin@kumim.my'
AND (organizer_code IS NULL OR organizer_code != 'ORG002');

-- Ensure Hazman's profile has correct organizer_code
UPDATE public.profiles
SET organizer_code = 'ORG002'
WHERE email = 'admin@kumim.my'
AND (organizer_code IS NULL OR organizer_code != 'ORG002');

-- Link manjaya.solution@gmail.com as staff to ORG002
UPDATE public.profiles
SET 
    role = 'staff',
    organizer_code = 'ORG002'
WHERE email = 'manjaya.solution@gmail.com';

-- Also update any other staff that should be under ORG002
UPDATE public.profiles
SET organizer_code = 'ORG002'
WHERE role = 'staff'
AND email != 'manjaya.solution@gmail.com'
AND (organizer_code IS NULL OR organizer_code = '');

-- ============================================================================
-- STEP 11: VERIFY THE FIX
-- ============================================================================

-- Show admin users and their organizer_codes
SELECT email, role, organizer_code 
FROM public.profiles 
WHERE email IN ('admin@kumim.my', 'admin@permit.com', 'manjaya.solution@gmail.com');

-- Show organizer records
SELECT email, name, organizer_code 
FROM public.organizers 
WHERE email IN ('admin@kumim.my', 'admin@permit.com');

-- Show staff count by organizer
SELECT organizer_code, COUNT(*) as staff_count
FROM public.profiles
WHERE role = 'staff'
GROUP BY organizer_code;
