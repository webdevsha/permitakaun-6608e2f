-- ============================================================================
-- FIX: admin@kumim.my as BOTH Admin & Organizer
-- This allows him to manage the system AND have tenants see his locations
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure admin@kumim.my has 'admin' role in profiles
-- (He can still have an organizer record for location linking)
-- ============================================================================
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@kumim.my';

-- ============================================================================
-- STEP 2: Ensure Hazman has an organizer record
-- (This is needed so locations can be linked to his organizer_id)
-- ============================================================================

-- Get Hazman's profile ID
DO $$
DECLARE
    hazman_profile_id UUID;
    hazman_org_id UUID;
BEGIN
    SELECT id INTO hazman_profile_id FROM public.profiles WHERE email = 'admin@kumim.my';
    
    IF hazman_profile_id IS NULL THEN
        RAISE EXCEPTION 'admin@kumim.my profile not found';
    END IF;
    
    -- Check if organizer record exists
    SELECT id INTO hazman_org_id FROM public.organizers WHERE email = 'admin@kumim.my';
    
    IF hazman_org_id IS NULL THEN
        -- Create organizer record for Hazman
        INSERT INTO public.organizers (id, name, email, organizer_code, status, accounting_status)
        VALUES (hazman_profile_id, 'Hazman Enterprise', 'admin@kumim.my', 'ORG002', 'active', 'active')
        RETURNING id INTO hazman_org_id;
        
        RAISE NOTICE 'Created organizer record for Hazman with ID: %', hazman_org_id;
    ELSE
        -- Update existing organizer record to ensure profile_id is set
        UPDATE public.organizers
        SET profile_id = hazman_profile_id,
            name = 'Hazman Enterprise',
            organizer_code = 'ORG002',
            status = 'active'
        WHERE id = hazman_org_id;
        
        RAISE NOTICE 'Updated organizer record for Hazman: %', hazman_org_id;
    END IF;

    -- ============================================================================
    -- STEP 3: Add Locations for Hazman's Organizer (if not exist)
    -- ============================================================================
    
    -- Location 1: Jalan Kebun
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE name = 'Jalan Kebun' AND organizer_id = hazman_org_id) THEN
        INSERT INTO public.locations (
            name, program_name, type, operating_days, days_per_week,
            total_lots, rate_khemah, rate_cbs, rate_monthly,
            status, organizer_id
        ) VALUES (
            'Jalan Kebun', 'Pasar Malam', 'daily', 'Sabtu & Ahad', 2,
            50, 50, 0, 0, 'active', hazman_org_id
        );
        RAISE NOTICE 'Created location: Jalan Kebun';
    END IF;
    
    -- Location 2: Pasar Malam Bandar Baru
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE name = 'Pasar Malam Bandar Baru' AND organizer_id = hazman_org_id) THEN
        INSERT INTO public.locations (
            name, program_name, type, operating_days, days_per_week,
            total_lots, rate_khemah, rate_cbs, rate_monthly,
            status, organizer_id
        ) VALUES (
            'Pasar Malam Bandar Baru', 'Pasar Malam Komuniti', 'daily', 'Sabtu & Ahad', 2,
            60, 40, 30, 0, 'active', hazman_org_id
        );
        RAISE NOTICE 'Created location: Pasar Malam Bandar Baru';
    END IF;
    
    -- Location 3: Bazaar Ramadan Taman Sri Muda
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE name = 'Bazaar Ramadan Taman Sri Muda' AND organizer_id = hazman_org_id) THEN
        INSERT INTO public.locations (
            name, program_name, type, operating_days, days_per_week,
            total_lots, rate_khemah, rate_cbs, rate_monthly,
            status, organizer_id
        ) VALUES (
            'Bazaar Ramadan Taman Sri Muda', 'Bazaar Ramadan 2025', 'daily', 'Isnin - Ahad', 7,
            100, 60, 40, 0, 'active', hazman_org_id
        );
        RAISE NOTICE 'Created location: Bazaar Ramadan Taman Sri Muda';
    END IF;

END $$;

-- ============================================================================
-- STEP 4: Create Test Tenants for ORG002
-- ============================================================================

-- Create tenant profiles if not exist
INSERT INTO public.profiles (id, email, full_name, role, organizer_code)
SELECT gen_random_uuid(), 'ahmad.org2@test.com', 'Ahmad Bin Abdullah', 'tenant', 'ORG002'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'ahmad.org2@test.com');

INSERT INTO public.profiles (id, email, full_name, role, organizer_code)
SELECT gen_random_uuid(), 'siti.org2@test.com', 'Siti Binti Ahmad', 'tenant', 'ORG002'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'siti.org2@test.com');

INSERT INTO public.profiles (id, email, full_name, role, organizer_code)
SELECT gen_random_uuid(), 'raj.org2@test.com', 'Raj A/L Kumar', 'tenant', 'ORG002'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'raj.org2@test.com');

-- Create tenant records if not exist
INSERT INTO public.tenants (profile_id, full_name, business_name, email, organizer_code, status, rental_type, rental_amount)
SELECT p.id, 'Ahmad Bin Abdullah', 'Nasi Lemak Sedap', 'ahmad.org2@test.com', 'ORG002', 'active', 'daily_khemah', 40
FROM public.profiles p WHERE p.email = 'ahmad.org2@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = 'ahmad.org2@test.com');

INSERT INTO public.tenants (profile_id, full_name, business_name, email, organizer_code, status, rental_type, rental_amount)
SELECT p.id, 'Siti Binti Ahmad', 'Butik Fesyen Siti', 'siti.org2@test.com', 'ORG002', 'active', 'daily_cbs', 30
FROM public.profiles p WHERE p.email = 'siti.org2@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = 'siti.org2@test.com');

INSERT INTO public.tenants (profile_id, full_name, business_name, email, organizer_code, status, rental_type, rental_amount)
SELECT p.id, 'Raj A/L Kumar', 'Rojak Mamak Raj', 'raj.org2@test.com', 'ORG002', 'active', 'monthly', 300
FROM public.profiles p WHERE p.email = 'raj.org2@test.com'
AND NOT EXISTS (SELECT 1 FROM public.tenants WHERE email = 'raj.org2@test.com');

-- ============================================================================
-- STEP 5: Link Manjaya as Staff to ORG002
-- ============================================================================

UPDATE public.profiles
SET role = 'staff', organizer_code = 'ORG002'
WHERE email = 'manjaya.solution@gmail.com';

-- Create profile if not exists
INSERT INTO public.profiles (id, email, full_name, role, organizer_code)
SELECT gen_random_uuid(), 'manjaya.solution@gmail.com', 'Staff Encik Hazman', 'staff', 'ORG002'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'manjaya.solution@gmail.com');

-- ============================================================================
-- STEP 6: Verify Results
-- ============================================================================

SELECT '=== ADMIN/ORGANIZER DUAL ROLE VERIFICATION ===' as title;

-- Show admin profile
SELECT 'Admin Profile' as check_type, email, role, organizer_code 
FROM public.profiles WHERE email = 'admin@kumim.my';

-- Show organizer record
SELECT 'Organizer Record' as check_type, email, name, organizer_code, status 
FROM public.organizers WHERE email = 'admin@kumim.my';

-- Show staff count
SELECT 'Staff Count' as check_type, COUNT(*)::text as value 
FROM public.profiles WHERE role = 'staff' AND organizer_code = 'ORG002';

-- Show locations
SELECT 'Locations' as check_type, COUNT(*)::text as count,
       string_agg(name, ', ') as names
FROM public.locations l 
JOIN public.organizers o ON l.organizer_id = o.id 
WHERE o.organizer_code = 'ORG002';

-- Show tenants
SELECT 'Tenants' as check_type, COUNT(*)::text as value 
FROM public.tenants WHERE organizer_code = 'ORG002';
