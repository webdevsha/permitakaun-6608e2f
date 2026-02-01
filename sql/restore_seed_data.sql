-- RESTORE SEED DATA
-- Run this if you have wiped the system and want the demo data back.

-- 1. Locations
INSERT INTO public.locations (name, type, rate_khemah, rate_cbs, rate_monthly, image_url)
SELECT 'Pasar Malam Seksyen 7', 'daily', 45, 35, 0, '/map-location.png'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Pasar Malam Seksyen 7');

INSERT INTO public.locations (name, type, rate_khemah, rate_cbs, rate_monthly, image_url)
SELECT 'Uptown Rimbayu', 'monthly', 0, 0, 650, '/uptown-map.jpg'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Uptown Rimbayu');

INSERT INTO public.locations (name, type, rate_khemah, rate_cbs, rate_monthly, image_url)
SELECT 'Pasar Tani Stadium', 'daily', 40, 30, 0, '/placeholder.jpg'
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Pasar Tani Stadium');

-- 2. Tenants (Demo Profiles)
-- Note: These do not have linked Auth Users, so they are "Offline" tenants.
INSERT INTO public.tenants (full_name, business_name, phone_number, email, status, ic_number, organizer_code)
SELECT 'Ahmad Ismail', 'Nasi Lemak Royale', '0123456789', 'ahmad@permit.com', 'active', '800101-10-1234', 'ORG001'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE email = 'ahmad@permit.com');

INSERT INTO public.tenants (full_name, business_name, phone_number, email, status, ic_number, organizer_code)
SELECT 'Siti Aminah', 'Siti Hijab Collection', '0198765432', 'siti@permit.com', 'active', '850505-10-5678', 'ORG001'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE email = 'siti@permit.com');

INSERT INTO public.tenants (full_name, business_name, phone_number, email, status, ic_number, organizer_code)
SELECT 'Mohd Faizal', 'Faizal Gadget', '0172233445', 'faizal@permit.com', 'active', '901212-10-9090', 'ORG001'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE email = 'faizal@permit.com');

-- 3. Tenant Locations (Link Tenants to Locations)
-- We use subqueries to find IDs dynamically
INSERT INTO public.tenant_locations (tenant_id, location_id, stall_number, rate_type, status)
SELECT 
    (SELECT id FROM tenants WHERE email = 'ahmad@permit.com'),
    (SELECT id FROM locations WHERE name = 'Pasar Malam Seksyen 7'),
    'A-12', 'khemah', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenant_locations WHERE stall_number = 'A-12');

INSERT INTO public.tenant_locations (tenant_id, location_id, stall_number, rate_type, status)
SELECT 
    (SELECT id FROM tenants WHERE email = 'siti@permit.com'),
    (SELECT id FROM locations WHERE name = 'Uptown Rimbayu'),
    'UP-05', 'monthly', 'active'
WHERE NOT EXISTS (SELECT 1 FROM tenant_locations WHERE stall_number = 'UP-05');

-- 4. Transactions (Accounting Data)
INSERT INTO public.transactions (tenant_id, amount, type, category, status, date, description)
SELECT 
    (SELECT id FROM tenants WHERE email = 'ahmad@permit.com'),
    45.00, 'income', 'Sewa Harian', 'approved', CURRENT_DATE, 'Sewa Tapak A-12'
WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE description = 'Sewa Tapak A-12' AND date = CURRENT_DATE);

INSERT INTO public.transactions (tenant_id, amount, type, category, status, date, description)
SELECT 
    (SELECT id FROM tenants WHERE email = 'siti@permit.com'),
    650.00, 'income', 'Sewa Bulanan', 'approved', CURRENT_DATE - 1, 'Sewa Uptown Bulan Mac'
WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE description = 'Sewa Uptown Bulan Mac');

INSERT INTO public.transactions (tenant_id, amount, type, category, status, date, description)
SELECT 
    (SELECT id FROM tenants WHERE email = 'faizal@permit.com'),
    30.00, 'income', 'Sewa CBS', 'pending', CURRENT_DATE, 'Sewa Tapak PTS-88'
WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE description = 'Sewa Tapak PTS-88');

-- 5. Expenses (Maintenance) - Linked to First Tenant as placeholder or NULL if allowed
-- Typically expenses might be linked to the Organizer (Self-Tenant) but for seed we use NULL if schema allows, 
-- or link to one of the tenants as 'Refund' etc.
-- Schema allows NULL tenant_id? Yes.
INSERT INTO public.transactions (tenant_id, amount, type, category, status, date, description)
VALUES (NULL, 120.00, 'expense', 'Penyelenggaraan', 'approved', CURRENT_DATE - 2, 'Baiki Paip Pecah')
ON CONFLICT DO NOTHING;
-- Note: ON CONFLICT might not work without constraint, but duplicate expense is fine for demo
