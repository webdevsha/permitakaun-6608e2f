-- FIX RLS Policy - Use correct column 'id' instead of 'profile_id' for Organizers
-- Organizers table uses 'id' as the FK to Auth/Profiles.

DROP POLICY IF EXISTS "Organizers manage tenant transactions" ON public.transactions;

CREATE POLICY "Organizers manage tenant transactions" ON public.transactions
FOR ALL TO authenticated
USING (
  -- 1. Tenant linked by Organizer Code
  exists (
    select 1 from public.tenants t
    join public.organizers o on t.organizer_code = o.organizer_code
    where t.id = transactions.tenant_id
    and o.id = auth.uid() -- Corrected from o.profile_id
  )
  OR
  -- 2. Tenant linked by Location Rental
  exists (
    select 1 from public.tenant_locations tl
    join public.locations l on tl.location_id = l.id
    where tl.tenant_id = transactions.tenant_id
    and l.organizer_id = auth.uid()
  )
);
