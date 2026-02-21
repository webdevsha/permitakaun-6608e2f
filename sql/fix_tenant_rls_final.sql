-- ============================================================================
-- FIX: Restore tenant RLS policies to working state
-- ============================================================================

-- 1. First, disable RLS on tenants temporarily to allow all reads
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. Drop ALL existing policies on tenants (comprehensive list)
DROP POLICY IF EXISTS "Organizer view linked tenants" ON public.tenants;
DROP POLICY IF EXISTS "Organizers can view linked tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants view own profile" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view own profile" ON public.tenants;
DROP POLICY IF EXISTS "Admin full access on tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Organizers can view their tenants" ON public.tenants;
DROP POLICY IF EXISTS "Tenants can view own data" ON public.tenants;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.tenants;
DROP POLICY IF EXISTS "Public read access" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated users can view tenants" ON public.tenants;

-- 4. Create simple, working policies

-- Policy 1: Tenants can view their own data
CREATE POLICY "Tenants can view own data" ON public.tenants
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- Policy 2: Admins can view all tenants
CREATE POLICY "Admins can view all tenants" ON public.tenants
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

-- Policy 3: Organizers can view tenants linked to them
CREATE POLICY "Organizers can view linked tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        -- Via tenant_organizers
        EXISTS (
            SELECT 1 FROM public.tenant_organizers to2
            JOIN public.organizers o ON o.id = to2.organizer_id
            WHERE to2.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
        OR
        -- Via tenant_locations
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.locations l ON l.id = tl.location_id
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE tl.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
        OR
        -- Via tenant_locations with direct organizer_id
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.organizers o ON o.id = tl.organizer_id
            WHERE tl.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
    );

-- 5. Grant proper permissions
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;

-- 6. Also fix tenant_locations RLS - simpler approach
ALTER TABLE public.tenant_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (comprehensive list)
DROP POLICY IF EXISTS "Organizer view tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Organizers view tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Organizer update tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Organizers update tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenant view own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants view own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Admins view all tenant locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.tenant_locations;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.tenant_locations;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.tenant_locations;

-- Create simple policies
CREATE POLICY "Tenants view own locations" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_locations.tenant_id
            AND t.profile_id = auth.uid()
        )
    );

CREATE POLICY "Organizers view tenant locations" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            JOIN public.locations l ON l.organizer_id = o.id
            WHERE o.profile_id = auth.uid()
            AND l.id = tenant_locations.location_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_locations.organizer_id
            AND o.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins view all tenant locations" ON public.tenant_locations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

GRANT SELECT, UPDATE ON public.tenant_locations TO authenticated;

-- 7. Fix tenant_organizers RLS
ALTER TABLE public.tenant_organizers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_organizers ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (comprehensive list)
DROP POLICY IF EXISTS "Tenants can view own requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Tenants view own requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers can view requests for themselves" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers view own requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers can update status" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers update requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Admins view all requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.tenant_organizers;

CREATE POLICY "Tenants view own requests" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_organizers.tenant_id
            AND t.profile_id = auth.uid()
        )
    );

CREATE POLICY "Organizers view own requests" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_organizers.organizer_id
            AND o.profile_id = auth.uid()
        )
    );

CREATE POLICY "Organizers update requests" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_organizers.organizer_id
            AND o.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins view all requests" ON public.tenant_organizers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenant_organizers TO authenticated;

-- Verify final state
SELECT 'RLS policies reset successfully' as status;

SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('tenants', 'tenant_locations', 'tenant_organizers')
GROUP BY tablename
ORDER BY tablename;
