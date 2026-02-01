-- Updated RLS for Transactions to match Dashboard Logic
-- Allows Organizers to see transactions from Tenants who:
-- 1. Have their Organizer Code
-- 2. OR Rent their Locations

DROP POLICY IF EXISTS "Organizers manage tenant transactions" ON public.transactions;

CREATE POLICY "Organizers manage tenant transactions" ON public.transactions
FOR ALL TO authenticated
USING (
  -- 1. Tenant linked by Organizer Code
  exists (
    select 1 from public.tenants t
    join public.organizers o on t.organizer_code = o.organizer_code
    where t.id = transactions.tenant_id
    and o.profile_id = auth.uid()
  )
  OR
  -- 2. Tenant linked by Location Rental (Even if different code)
  exists (
    select 1 from public.tenant_locations tl
    join public.locations l on tl.location_id = l.id
    where tl.tenant_id = transactions.tenant_id
    and l.organizer_id = auth.uid()
  )
)
WITH CHECK (
  -- Same logic for Insert/Update
  exists (
    select 1 from public.tenants t
    join public.organizers o on t.organizer_code = o.organizer_code
    where t.id = tenant_id
    and o.profile_id = auth.uid()
  )
  OR
  exists (
    select 1 from public.tenant_locations tl
    join public.locations l on tl.location_id = l.id
    where tl.tenant_id = tenant_id
    and l.organizer_id = auth.uid()
  )
);
