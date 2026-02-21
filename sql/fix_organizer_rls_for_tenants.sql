-- Fix RLS policy to allow tenants to view organizers they are linked to
-- This is needed for the "Mohon Program Baru" feature

DROP POLICY IF EXISTS "Tenants view linked organizers" ON public.organizers;

CREATE POLICY "Tenants view linked organizers" 
ON public.organizers 
FOR SELECT 
TO authenticated
USING (
    -- Allow if tenant is linked to this organizer via tenant_organizers
    EXISTS (
        SELECT 1 FROM public.tenant_organizers to2
        JOIN public.tenants t ON t.id = to2.tenant_id
        WHERE to2.organizer_id = organizers.id
        AND t.profile_id = auth.uid()
    )
    OR
    -- Or if user is the organizer themselves
    profile_id = auth.uid()
    OR
    -- Or if user is admin/staff (existing checks)
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin', 'staff')
    )
);

-- Also ensure the locations query can work without the inner join restriction
-- by granting proper access
GRANT SELECT ON public.organizers TO authenticated;
GRANT SELECT ON public.locations TO authenticated;

COMMENT ON POLICY "Tenants view linked organizers" ON public.organizers IS 
'Allow tenants to view organizers they have a link with (approved or pending)';
