-- ============================================================================
-- FIX ORG002 DATA - Update admin role and add missing test data
-- ============================================================================

-- ============================================================================
-- STEP 1: Fix admin@kumim.my role to 'admin' in database
-- ============================================================================
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@kumim.my';

-- ============================================================================
-- STEP 2: Update existing tenants to have ORG002 organizer_code
-- (The test tenants that should belong to Hazman's organization)
-- ============================================================================

-- Let's check what tenants exist with no organizer_code and assign them
-- These are likely test tenants that should belong to ORG002
UPDATE public.tenants
SET organizer_code = 'ORG002'
WHERE organizer_code IS NULL 
   OR organizer_code = ''
   OR organizer_code = 'ORG_KUMIM';

-- Also update the profiles for these tenants
UPDATE public.profiles
SET organizer_code = 'ORG002'
WHERE email IN (
    SELECT email FROM public.tenants 
    WHERE organizer_code = 'ORG002'
);

-- ============================================================================
-- STEP 3: Link Hazman's existing location properly
-- ============================================================================

-- Ensure the location "Jalan Kebun" is linked to Hazman's organizer record
UPDATE public.locations
SET organizer_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
WHERE name = 'Jalan Kebun';

-- ============================================================================
-- STEP 4: Add more locations for ORG002 if needed
-- ============================================================================

-- Insert additional test locations for ORG002
INSERT INTO public.locations (
    name, program_name, type, operating_days, days_per_week, 
    total_lots, rate_khemah, rate_cbs, rate_monthly,
    rate_monthly_khemah, rate_monthly_cbs,
    status, organizer_id
) VALUES 
(
    'Pasar Malam Bandar Baru', 
    'Pasar Malam Komuniti',
    'daily',
    'Sabtu & Ahad',
    2,
    60,
    40.00,
    30.00,
    0,
    0,
    0,
    'active',
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
),
(
    'Bazaar Ramadan Taman Sri Muda', 
    'Bazaar Ramadan 2025',
    'daily',
    'Isnin - Ahad',
    7,
    100,
    60.00,
    40.00,
    0,
    0,
    0,
    'active',
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Create test tenants for ORG002
-- ============================================================================

-- Create profiles for test tenants
INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at)
VALUES 
    (gen_random_uuid(), 'ahmad.kumim@test.com', 'Ahmad Bin Ali', 'tenant', 'ORG002', NOW()),
    (gen_random_uuid(), 'siti.kumim@test.com', 'Siti Nurhaliza', 'tenant', 'ORG002', NOW()),
    (gen_random_uuid(), 'raj.kumim@test.com', 'Raj Kumar', 'tenant', 'ORG002', NOW())
ON CONFLICT (email) DO NOTHING;

-- Create tenant records
INSERT INTO public.tenants (
    profile_id, full_name, business_name, business_type, 
    phone, email, ic_number, lot_number, 
    rental_type, rental_amount, organizer_code, status
)
SELECT 
    p.id,
    'Ahmad Bin Ali',
    'Nasi Lemak Ahmad',
    'Makanan',
    '0123456789',
    'ahmad.kumim@test.com',
    '850612105234',
    'A01',
    'daily_khemah',
    40.00,
    'ORG002',
    'active'
FROM public.profiles p
WHERE p.email = 'ahmad.kumim@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.email = 'ahmad.kumim@test.com');

INSERT INTO public.tenants (
    profile_id, full_name, business_name, business_type, 
    phone, email, ic_number, lot_number, 
    rental_type, rental_amount, organizer_code, status
)
SELECT 
    p.id,
    'Siti Nurhaliza',
    'Butik Siti',
    'Pakaian',
    '0134567890',
    'siti.kumim@test.com',
    '880815104567',
    'B05',
    'daily_cbs',
    30.00,
    'ORG002',
    'active'
FROM public.profiles p
WHERE p.email = 'siti.kumim@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.email = 'siti.kumim@test.com');

INSERT INTO public.tenants (
    profile_id, full_name, business_name, business_type, 
    phone, email, ic_number, lot_number, 
    rental_type, rental_amount, organizer_code, status
)
SELECT 
    p.id,
    'Raj Kumar',
    'Rojak Mamak Raj',
    'Makanan',
    '0145678901',
    'raj.kumim@test.com',
    '900203103456',
    'C12',
    'monthly',
    500.00,
    'ORG002',
    'active'
FROM public.profiles p
WHERE p.email = 'raj.kumim@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.email = 'raj.kumim@test.com');

-- ============================================================================
-- STEP 6: Add sample transactions for ORG002 tenants
-- ============================================================================

DO $$
DECLARE
    ahmad_id INTEGER;
    siti_id INTEGER;
    raj_id INTEGER;
BEGIN
    SELECT id INTO ahmad_id FROM public.tenants WHERE email = 'ahmad.kumim@test.com';
    SELECT id INTO siti_id FROM public.tenants WHERE email = 'siti.kumim@test.com';
    SELECT id INTO raj_id FROM public.tenants WHERE email = 'raj.kumim@test.com';

    -- Transactions for Ahmad
    IF ahmad_id IS NOT NULL THEN
        INSERT INTO public.transactions (tenant_id, type, amount, date, status, description)
        VALUES 
            (ahmad_id, 'rental', 40.00, CURRENT_DATE - INTERVAL '2 days', 'paid', 'Sewa harian'),
            (ahmad_id, 'rental', 40.00, CURRENT_DATE - INTERVAL '5 days', 'paid', 'Sewa harian'),
            (ahmad_id, 'compound', 50.00, CURRENT_DATE - INTERVAL '10 days', 'paid', 'Kompaun tapak kotor')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Transactions for Siti
    IF siti_id IS NOT NULL THEN
        INSERT INTO public.transactions (tenant_id, type, amount, date, status, description)
        VALUES 
            (siti_id, 'rental', 30.00, CURRENT_DATE - INTERVAL '1 day', 'paid', 'Sewa harian'),
            (siti_id, 'rental', 30.00, CURRENT_DATE - INTERVAL '4 days', 'paid', 'Sewa harian')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Transactions for Raj
    IF raj_id IS NOT NULL THEN
        INSERT INTO public.transactions (tenant_id, type, amount, date, status, description)
        VALUES 
            (raj_id, 'rental', 500.00, CURRENT_DATE - INTERVAL '5 days', 'paid', 'Sewa bulanan Januari'),
            (raj_id, 'rental', 500.00, CURRENT_DATE - INTERVAL '35 days', 'paid', 'Sewa bulanan Disember')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- STEP 7: Verify results
-- ============================================================================

SELECT '=== ORG002 DATA SUMMARY ===' as info;

SELECT 'Admin Profile' as type, email, role, organizer_code 
FROM public.profiles WHERE email = 'admin@kumim.my';

SELECT 'Staff Count' as type, COUNT(*)::text as value 
FROM public.profiles WHERE role = 'staff' AND organizer_code = 'ORG002';

SELECT 'Organizers' as type, name, organizer_code 
FROM public.organizers WHERE organizer_code = 'ORG002';

SELECT 'Locations Count' as type, COUNT(*)::text as value 
FROM public.locations l 
JOIN public.organizers o ON l.organizer_id = o.id 
WHERE o.organizer_code = 'ORG002';

SELECT 'Tenants Count' as type, COUNT(*)::text as value 
FROM public.tenants WHERE organizer_code = 'ORG002';

SELECT 'Transactions Count' as type, COUNT(*)::text as value 
FROM public.transactions t 
JOIN public.tenants tn ON t.tenant_id = tn.id 
WHERE tn.organizer_code = 'ORG002';
