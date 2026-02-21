-- ============================================================================
-- CREATE FRESH POLICIES after dropping all
-- Run this AFTER running drop_all_policies.sql
-- ============================================================================

-- ============================================
-- TENANTS TABLE
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenants can view their own data
CREATE POLICY "tenants_view_own" ON public.tenants
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- Policy 2: Admins can view all tenants
CREATE POLICY "admins_view_all_tenants" ON public.tenants
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

-- Policy 3: Organizers can view linked tenants
CREATE POLICY "organizers_view_linked_tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_organizers to2
            JOIN public.organizers o ON o.id = to2.organizer_id
            WHERE to2.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.locations l ON l.id = tl.location_id
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE tl.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.organizers o ON o.id = tl.organizer_id
            WHERE tl.tenant_id = tenants.id
            AND o.profile_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;

-- ============================================
-- TENANT_LOCATIONS TABLE
-- ============================================
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenants view own locations
CREATE POLICY "tenant_locs_view_own" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_locations.tenant_id
            AND t.profile_id = auth.uid()
        )
    );

-- Policy 2: Organizers view tenant locations
CREATE POLICY "organizer_locs_view" ON public.tenant_locations
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

-- Policy 3: Admins view all
CREATE POLICY "admin_locs_all" ON public.tenant_locations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

GRANT SELECT, UPDATE ON public.tenant_locations TO authenticated;

-- ============================================
-- TENANT_ORGANIZERS TABLE
-- ============================================
ALTER TABLE public.tenant_organizers ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenants view own requests
CREATE POLICY "tenant_org_view_own" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_organizers.tenant_id
            AND t.profile_id = auth.uid()
        )
    );

-- Policy 2: Organizers view own requests
CREATE POLICY "organizer_org_view" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_organizers.organizer_id
            AND o.profile_id = auth.uid()
        )
    );

-- Policy 3: Organizers update requests
CREATE POLICY "organizer_org_update" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_organizers.organizer_id
            AND o.profile_id = auth.uid()
        )
    );

-- Policy 4: Admins all access
CREATE POLICY "admin_org_all" ON public.tenant_organizers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenant_organizers TO authenticated;

-- Verify
SELECT 'Policies created successfully' as status;

SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('tenants', 'tenant_locations', 'tenant_organizers')
GROUP BY tablename
ORDER BY tablename;
