-- Allow Tenants to apply for a location (INSERT)
CREATE POLICY "Tenants can apply for location" ON public.tenant_locations
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT profile_id FROM public.tenants WHERE id = tenant_id
  )
);

-- Allow Organizers to update status (Approve/Reject)
CREATE POLICY "Organizers can update application" ON public.tenant_locations
FOR UPDATE TO authenticated
USING (
  exists (
    select 1 from public.locations l
    join public.organizers o on l.organizer_id = o.id
    where l.id = tenant_locations.location_id
    and o.profile_id = auth.uid()
  )
);

-- Allow Tenants to update their own application (e.g. status cancel?) 
-- Maybe not needed yet, but safe to allow if needed later.

-- Allow Admins/Staff full access
CREATE POLICY "Admins/Staff full access tenant_locations" ON public.tenant_locations
FOR ALL TO authenticated
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'superadmin', 'staff')
  )
);
