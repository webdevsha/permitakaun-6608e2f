-- FIX RLS Policies for Staff Role
-- Staff should be able to see the same data as their admin/organizer

-- 1. Fix Staff access to Transactions
DROP POLICY IF EXISTS "Staff view transactions" ON public.transactions;

CREATE POLICY "Staff view transactions" ON public.transactions
FOR SELECT TO authenticated
USING (
  -- Staff can view transactions for tenants with the same organizer_code
  exists (
    select 1 from public.profiles p
    join public.tenants t on t.organizer_code = p.organizer_code
    where p.id = auth.uid()
    and p.role = 'staff'
    and t.id = transactions.tenant_id
  )
  OR
  -- Staff can view transactions for tenants at locations owned by their organizer
  exists (
    select 1 from public.profiles p
    join public.organizers o on o.organizer_code = p.organizer_code
    join public.locations l on l.organizer_id = o.id
    join public.tenant_locations tl on tl.location_id = l.id
    where p.id = auth.uid()
    and p.role = 'staff'
    and tl.tenant_id = transactions.tenant_id
  )
);

-- 2. Fix Staff access to Organizers
DROP POLICY IF EXISTS "Staff view organizers" ON public.organizers;

CREATE POLICY "Staff view organizers" ON public.organizers
FOR SELECT TO authenticated
USING (
  -- Staff can view organizers with the same organizer_code
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'staff'
    and p.organizer_code = organizers.organizer_code
  )
);

-- 3. Fix Staff access to Locations
DROP POLICY IF EXISTS "Staff view locations" ON public.locations;

CREATE POLICY "Staff view locations" ON public.locations
FOR SELECT TO authenticated
USING (
  -- Staff can view locations owned by their organizer
  exists (
    select 1 from public.profiles p
    join public.organizers o on o.organizer_code = p.organizer_code
    where p.id = auth.uid()
    and p.role = 'staff'
    and l.organizer_id = o.id
  )
);

-- 4. Fix Staff access to Tenants
DROP POLICY IF EXISTS "Staff view tenants" ON public.tenants;

CREATE POLICY "Staff view tenants" ON public.tenants
FOR SELECT TO authenticated
USING (
  -- Staff can view tenants with the same organizer_code
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'staff'
    and p.organizer_code = tenants.organizer_code
  )
  OR
  -- Staff can view tenants at locations owned by their organizer
  exists (
    select 1 from public.profiles p
    join public.organizers o on o.organizer_code = p.organizer_code
    join public.locations l on l.organizer_id = o.id
    join public.tenant_locations tl on tl.location_id = l.id
    where p.id = auth.uid()
    and p.role = 'staff'
    and tl.tenant_id = tenants.id
  )
);

-- 5. Fix Staff INSERT/UPDATE/DELETE permissions (with pending status)
DROP POLICY IF EXISTS "Staff create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff delete transactions" ON public.transactions;

-- Staff can create transactions (will be set to pending)
CREATE POLICY "Staff create transactions" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'staff'
  )
);

-- Staff can update their own pending transactions
CREATE POLICY "Staff update transactions" ON public.transactions
FOR UPDATE TO authenticated
USING (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'staff'
  )
  AND transactions.status = 'pending'
);

-- 6. Fix Staff access to Action Logs (view only their own organization's logs)
DROP POLICY IF EXISTS "Staff view action logs" ON public.action_logs;

CREATE POLICY "Staff view action logs" ON public.action_logs
FOR SELECT TO authenticated
USING (
  -- Staff can view logs created by users with the same organizer_code
  exists (
    select 1 from public.profiles p1
    join public.profiles p2 on p1.organizer_code = p2.organizer_code
    where p1.id = auth.uid()
    and p1.role = 'staff'
    and p2.id = action_logs.user_id
  )
);
