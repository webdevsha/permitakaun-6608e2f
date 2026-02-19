-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies
-- Use SECURITY DEFINER functions to break circular dependencies
-- ============================================================================

-- Function 1: Check if current user is the tenant owner
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_tenant_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id
    AND profile_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Check if current user is the organizer of a tenant link
CREATE OR REPLACE FUNCTION public.is_organizer_of_link(p_organizer_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organizers
    WHERE id = p_organizer_id
    AND profile_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Check if current user (organizer) is linked to a tenant
CREATE OR REPLACE FUNCTION public.is_linked_organizer_of_tenant(p_tenant_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenant_organizers
    WHERE tenant_id = p_tenant_id
    AND organizer_id IN (
      SELECT id FROM public.organizers WHERE profile_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update policies for tenant_organizers
-- ============================================================================

DROP POLICY IF EXISTS "Tenants can view own requests" ON public.tenant_organizers;
CREATE POLICY "Tenants can view own requests" ON public.tenant_organizers
  FOR SELECT USING (public.is_tenant_owner(tenant_id));

DROP POLICY IF EXISTS "Organizers can view requests for themselves" ON public.tenant_organizers;
CREATE POLICY "Organizers can view requests for themselves" ON public.tenant_organizers
  FOR SELECT USING (public.is_organizer_of_link(organizer_id));

DROP POLICY IF EXISTS "Organizers can update status" ON public.tenant_organizers;
CREATE POLICY "Organizers can update status" ON public.tenant_organizers
  FOR UPDATE USING (public.is_organizer_of_link(organizer_id));

-- ============================================================================
-- Update policies for tenants
-- ============================================================================

DROP POLICY IF EXISTS "Organizers can view linked tenants" ON public.tenants;
CREATE POLICY "Organizers can view linked tenants" ON public.tenants
  FOR SELECT USING (public.is_linked_organizer_of_tenant(id));

-- Also fix existing "Organizers view own tenants" which might be redundant or recursive
DROP POLICY IF EXISTS "Organizers view own tenants" ON public.tenants;
-- Admin/Staff access is already handled by other policies in fix_admin_rls_final.sql
-- We can keep this one simple or rely on "Organizers can view linked tenants"

-- ============================================================================
-- Cleanup any other problematic policies from debug output
-- ============================================================================

-- The debug output showed some policies using check_admin_access() which might 
-- be defined elsewhere. Let's ensure our core functions are solid.
