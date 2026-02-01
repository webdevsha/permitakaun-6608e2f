-- 1. Fix Tenant Deletion (Cascade Transactions)
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_tenant_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(id)
ON DELETE CASCADE;

ALTER TABLE public.tenant_locations
DROP CONSTRAINT IF EXISTS tenant_locations_tenant_id_fkey;

ALTER TABLE public.tenant_locations
ADD CONSTRAINT tenant_locations_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(id)
ON DELETE CASCADE;

-- 2. Create System Settings Table (for Billplz Mode)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz default now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
DROP POLICY IF EXISTS "Authenticated read settings" ON public.system_settings;
CREATE POLICY "Authenticated read settings" ON public.system_settings FOR SELECT USING (auth.role() = 'authenticated');

-- Allow update access to admins/staff
DROP POLICY IF EXISTS "Admin update settings" ON public.system_settings;
CREATE POLICY "Admin update settings" ON public.system_settings FOR UPDATE USING (
  exists (select 1 from profiles where id = auth.uid() and role IN ('admin', 'staff', 'superadmin'))
);

DROP POLICY IF EXISTS "Admin insert settings" ON public.system_settings;
CREATE POLICY "Admin insert settings" ON public.system_settings FOR INSERT WITH CHECK (
  exists (select 1 from profiles where id = auth.uid() and role IN ('admin', 'staff', 'superadmin'))
);

-- Seed defaults if not exist
INSERT INTO public.system_settings (key, value) VALUES 
('payment_mode', 'sandbox'), 
('trial_period_days', '14')
ON CONFLICT (key) DO NOTHING;

-- 3. Superadmin Role Fix (Ensure 'superadmin' is a valid role check constraint)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('tenant', 'staff', 'admin', 'superadmin', 'organizer'));

-- 4. Global Data Wipe Function (for "Clear ALL Data for ALL")
CREATE OR REPLACE FUNCTION public.wipe_all_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Delete all operational data
  DELETE FROM public.transactions;
  DELETE FROM public.tenant_locations;
  DELETE FROM public.tenants;
  DELETE FROM public.locations;
  DELETE FROM public.organizers; -- Optional: Keep organizers? User said "all data for all"
  
  -- Keep profiles but reset roles? No, keeps accounts.
  
  RAISE NOTICE 'All system data wiped.';
END;
$$;
