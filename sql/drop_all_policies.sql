-- ============================================================================
-- DROP ALL POLICIES on key tables
-- Run this first to clear everything
-- ============================================================================

-- Drop all policies on tenants
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

-- Drop all policies on tenant_locations
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

-- Drop all policies on tenant_organizers
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

SELECT 'All policies dropped' as status;
