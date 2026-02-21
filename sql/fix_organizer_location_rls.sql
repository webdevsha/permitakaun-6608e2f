-- ============================================================================
-- FIX: Organizer RLS Policies for Locations
-- ============================================================================

-- 1. Organizer can view their own locations
DROP POLICY IF EXISTS "Organizer view own locations" ON public.locations;

CREATE POLICY "Organizer view own locations" ON public.locations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = locations.organizer_id
        )
    );

-- 2. Organizer can insert their own locations
DROP POLICY IF EXISTS "Organizer insert own locations" ON public.locations;

CREATE POLICY "Organizer insert own locations" ON public.locations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = locations.organizer_id
        )
    );

-- 3. Organizer can update their own locations
DROP POLICY IF EXISTS "Organizer update own locations" ON public.locations;

CREATE POLICY "Organizer update own locations" ON public.locations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = locations.organizer_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = locations.organizer_id
        )
    );

-- 4. Organizer can delete their own locations
DROP POLICY IF EXISTS "Organizer delete own locations" ON public.locations;

CREATE POLICY "Organizer delete own locations" ON public.locations
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = locations.organizer_id
        )
    );

-- 5. Organizer can view their own tenant_organizers (linking table)
DROP POLICY IF EXISTS "Organizer view own tenant_organizers" ON public.tenant_organizers;

CREATE POLICY "Organizer view own tenant_organizers" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = tenant_organizers.organizer_id
        )
    );

-- 6. Organizer can view tenant_locations for their locations
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
    );

-- Verify policies were created
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('locations', 'tenant_organizers', 'tenant_locations')
AND policyname LIKE '%Organizer%'
ORDER BY tablename, policyname;

SELECT 'Organizer RLS policies added successfully' as status;
