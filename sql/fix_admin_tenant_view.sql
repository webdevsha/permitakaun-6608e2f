-- ============================================================================
-- FIX: Ensure admin can view all tenants
-- ============================================================================

-- 1. Disable and re-enable RLS on tenants
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL policies on tenants
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'tenants' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenants', pol.policyname);
    END LOOP;
END $$;

-- 3. Create simple policies

-- Policy 1: Everyone can view all tenants (simpler approach)
-- This is needed for admin@kumim.my to see tenants
CREATE POLICY "allow_select_all" ON public.tenants
    FOR SELECT TO authenticated
    USING (true);

-- Policy 2: Only admins can modify all tenants
CREATE POLICY "allow_admin_all" ON public.tenants
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin')
        )
    );

-- Policy 3: Tenants can update their own profile
CREATE POLICY "tenant_update_own" ON public.tenants
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid());

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;

-- 5. Do the same for tenant_locations
ALTER TABLE public.tenant_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_locations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'tenant_locations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_locations', pol.policyname);
    END LOOP;
END $$;

-- Simple policy: authenticated users can view all
CREATE POLICY "allow_select_all_tl" ON public.tenant_locations
    FOR SELECT TO authenticated
    USING (true);

-- But only organizers/admins can update
CREATE POLICY "allow_update_organizer" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'organizer')
        )
    );

-- 6. Do the same for tenant_organizers
ALTER TABLE public.tenant_organizers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_organizers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'tenant_organizers' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_organizers', pol.policyname);
    END LOOP;
END $$;

-- Simple policy: authenticated users can view all
CREATE POLICY "allow_select_all_to" ON public.tenant_organizers
    FOR SELECT TO authenticated
    USING (true);

-- Admins and organizers can update
CREATE POLICY "allow_update_organizer_to" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'superadmin', 'organizer')
        )
    );

CREATE POLICY "allow_insert_to" ON public.tenant_organizers
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.tenant_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_organizers TO authenticated;

SELECT 'Simplified RLS policies applied - all authenticated users can view tenants' as status;
