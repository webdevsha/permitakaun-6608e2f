-- Drop potentially conflicting or insecure policies
DROP POLICY IF EXISTS "Auth create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins full access transactions" ON public.transactions;
DROP POLICY IF EXISTS "Organizers manage tenant transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenants read own transactions" ON public.transactions;

-- 1. Admins & Staff: Full Control (Select, Insert, Update, Delete)
CREATE POLICY "Admins full access transactions" ON public.transactions
FOR ALL TO authenticated
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'superadmin', 'staff')
  )
);

-- 2. Organizers: Manage transactions for THEIR tenants only
-- This allows Hazman (ORG002) to add transactions for his tenants, but not others.
CREATE POLICY "Organizers manage tenant transactions" ON public.transactions
FOR ALL TO authenticated
USING (
  exists (
    select 1 from public.tenants t
    join public.organizers o on t.organizer_code = o.organizer_code
    where t.id = transactions.tenant_id
    and o.profile_id = auth.uid()
  )
)
WITH CHECK (
  exists (
    select 1 from public.tenants t
    join public.organizers o on t.organizer_code = o.organizer_code
    where t.id = tenant_id
    and o.profile_id = auth.uid()
  )
);

-- 3. Tenants: Read Only (View their own transactions)
CREATE POLICY "Tenants read own transactions" ON public.transactions
FOR SELECT TO authenticated
USING (
  exists (
    select 1 from public.tenants
    where id = transactions.tenant_id
    and profile_id = auth.uid()
  )
);
