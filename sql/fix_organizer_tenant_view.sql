-- ============================================================================
-- FIX: Organizer can view tenants linked to their locations
-- ============================================================================

-- 1. Ensure RLS is enabled on tenant_locations
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Organizer can view tenant_locations for their locations
DROP POLICY IF EXISTS "Organizer view tenant_locations" ON public.tenant_locations;

CREATE POLICY "Organizer view tenant_locations" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers o
            JOIN public.locations l ON l.organizer_id = o.id
            WHERE o.profile_id = auth.uid()
            AND l.id = tenant_locations.location_id
        )
        OR
        -- Also allow viewing if organizer_id matches directly
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.profile_id = auth.uid()
            AND o.id = tenant_locations.organizer_id
        )
    );

-- 3. Policy: Organizer can update tenant_locations for their locations (approve/reject)
DROP POLICY IF EXISTS "Organizer update tenant_locations" ON public.tenant_locations;

CREATE POLICY "Organizer update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
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
            WHERE o.profile_id = auth.uid()
            AND o.id = tenant_locations.organizer_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizers o
            JOIN public.locations l ON l.organizer_id = o.id
            WHERE o.profile_id = auth.uid()
            AND l.id = tenant_locations.location_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.profile_id = auth.uid()
            AND o.id = tenant_locations.organizer_id
        )
    );

-- 4. Policy: Organizer can view tenants (global view for linked tenants)
DROP POLICY IF EXISTS "Organizer view linked tenants" ON public.tenants;

CREATE POLICY "Organizer view linked tenants" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        -- Tenant is linked via tenant_organizers
        EXISTS (
            SELECT 1 FROM public.tenant_organizers to2
            JOIN public.organizers o ON o.id = to2.organizer_id
            WHERE o.profile_id = auth.uid()
            AND to2.tenant_id = tenants.id
        )
        OR
        -- Tenant is linked via tenant_locations (renting at organizer's locations)
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.locations l ON l.id = tl.location_id
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE o.profile_id = auth.uid()
            AND tl.tenant_id = tenants.id
        )
        OR
        -- Tenant is linked via tenant_locations with direct organizer_id
        EXISTS (
            SELECT 1 FROM public.tenant_locations tl
            JOIN public.organizers o ON o.id = tl.organizer_id
            WHERE o.profile_id = auth.uid()
            AND tl.tenant_id = tenants.id
        )
    );

-- Verify policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('tenant_locations', 'tenants')
AND policyname LIKE '%Organizer%'
ORDER BY tablename, policyname;

SELECT 'Organizer tenant view policies updated successfully' as status;
