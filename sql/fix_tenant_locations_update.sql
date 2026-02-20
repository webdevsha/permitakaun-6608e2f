-- Allow Tenants to update their own application properties (e.g. rate_type, status to active)
DROP POLICY IF EXISTS "Tenants can update their own application" ON public.tenant_locations;
CREATE POLICY "Tenants can update their own application" ON public.tenant_locations
FOR UPDATE TO authenticated
USING (
  auth.uid() IN (
    SELECT profile_id FROM public.tenants WHERE id = tenant_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT profile_id FROM public.tenants WHERE id = tenant_id
  )
);
