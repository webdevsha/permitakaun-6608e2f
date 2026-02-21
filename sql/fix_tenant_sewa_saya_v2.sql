-- ============================================================================
-- FIX: Tenant Sewa Saya Empty Issue (Version 2 - Handle existing policies)
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix RLS policies for tenant_locations (drop first, then create)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Tenants can view own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Organizers can view tenant locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants can manage own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants can insert own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants can update own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Tenants can delete own locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Admin full access tenant_locations" ON public.tenant_locations;

-- Create policy for tenants to see their own locations
CREATE POLICY "Tenants can view own locations"
    ON public.tenant_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = tenant_locations.tenant_id
            AND tenants.profile_id = auth.uid()
        )
    );

-- Create policy for organizers to see tenant locations at their locations
CREATE POLICY "Organizers can view tenant locations"
    ON public.tenant_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE organizers.id = tenant_locations.organizer_id
            AND organizers.profile_id = auth.uid()
        )
    );

-- Create policy for tenants to insert their own locations
CREATE POLICY "Tenants can insert own locations"
    ON public.tenant_locations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = tenant_locations.tenant_id
            AND tenants.profile_id = auth.uid()
        )
    );

-- Create policy for tenants to update their own locations
CREATE POLICY "Tenants can update own locations"
    ON public.tenant_locations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = tenant_locations.tenant_id
            AND tenants.profile_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 2: Fix RLS for tenant_organizers
-- ============================================================================

ALTER TABLE public.tenant_organizers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Tenants can view own requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers can view requests for themselves" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Tenants can insert own requests" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Organizers can update requests" ON public.tenant_organizers;

-- Tenants can view their own requests
CREATE POLICY "Tenants can view own requests"
    ON public.tenant_organizers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = tenant_organizers.tenant_id
            AND tenants.profile_id = auth.uid()
        )
    );

-- Organizers can view requests for themselves
CREATE POLICY "Organizers can view requests for themselves"
    ON public.tenant_organizers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE organizers.id = tenant_organizers.organizer_id
            AND organizers.profile_id = auth.uid()
        )
    );

-- Tenants can insert requests
CREATE POLICY "Tenants can insert own requests"
    ON public.tenant_organizers
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE tenants.id = tenant_organizers.tenant_id
            AND tenants.profile_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 3: Fix RLS for locations
-- ============================================================================

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public read active locations" ON public.locations;
DROP POLICY IF EXISTS "Organizers can manage own locations" ON public.locations;
DROP POLICY IF EXISTS "Admin full access locations" ON public.locations;

-- Public can view active locations
CREATE POLICY "Public read active locations"
    ON public.locations
    FOR SELECT
    USING (status = 'active');

-- Organizers can manage their own locations
CREATE POLICY "Organizers can manage own locations"
    ON public.locations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE organizers.id = locations.organizer_id
            AND organizers.profile_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 4: Grant necessary permissions
-- ============================================================================

GRANT SELECT ON public.locations TO authenticated;
GRANT SELECT ON public.locations TO anon;
GRANT SELECT ON public.organizers TO authenticated;
GRANT SELECT ON public.organizers TO anon;
GRANT ALL ON public.tenant_locations TO authenticated;
GRANT ALL ON public.tenant_organizers TO authenticated;

-- ============================================================================
-- STEP 5: Verify fixes
-- ============================================================================

SELECT 'RLS POLICIES FIXED' as status;

-- Show current policies
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN ('tenant_locations', 'tenant_organizers', 'locations')
ORDER BY tablename, policyname;
