-- ============================================================================
-- FIX: Organizer can count tenant_locations for their locations
-- ============================================================================
-- This fixes the issue where organizers get RLS errors when trying to count
-- tenants for their locations in the fetchLocations function.
-- ============================================================================

-- 1. Ensure RLS is enabled on tenant_locations
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to start fresh (avoid conflicts)
DROP POLICY IF EXISTS "Organizer view tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Organizer view tenant_locations for counting" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants can view own tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenant view own locations" ON public.tenant_locations;

-- 3. Create a comprehensive policy for viewing tenant_locations
CREATE POLICY "Organizer view tenant_locations" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (
        -- Organizer can view tenant_locations for their own locations
        EXISTS (
            SELECT 1 FROM public.locations l
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE l.id = tenant_locations.location_id
            AND o.profile_id = auth.uid()
        )
        OR
        -- Organizer can view tenant_locations where organizer_id matches
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_locations.organizer_id
            AND o.profile_id = auth.uid()
        )
        OR
        -- Tenant can view their own tenant_locations
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_locations.tenant_id
            AND t.profile_id = auth.uid()
        )
        OR
        -- Admin can view all
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

-- 4. Policy for organizers to update tenant_locations (approve/reject)
DROP POLICY IF EXISTS "Organizer update tenant_locations" ON public.tenant_locations;

CREATE POLICY "Organizer update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.locations l
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE l.id = tenant_locations.location_id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_locations.organizer_id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.locations l
            JOIN public.organizers o ON o.id = l.organizer_id
            WHERE l.id = tenant_locations.location_id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.organizers o
            WHERE o.id = tenant_locations.organizer_id
            AND o.profile_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

-- 5. Grant permissions
GRANT SELECT, UPDATE ON public.tenant_locations TO authenticated;

-- 6. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_locations_location_id ON public.tenant_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_organizer_id ON public.tenant_locations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_tenant_id ON public.tenant_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_status ON public.tenant_locations(status);

-- 7. Verify policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'tenant_locations'
ORDER BY policyname;

SELECT 'tenant_locations RLS policies fixed for counting' as status;
