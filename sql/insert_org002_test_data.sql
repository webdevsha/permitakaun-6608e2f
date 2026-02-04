-- ============================================================================
-- INSERT TEST DATA FOR ORG002 (admin@kumim.my organization)
-- This creates Hazman's organization with sample data
-- ============================================================================

-- ============================================================================
-- STEP 1: Get or Create Hazman's Organizer Record
-- ============================================================================

-- First, ensure Hazman (admin@kumim.my) has an organizer record
INSERT INTO public.organizers (id, name, email, phone, organizer_code, status, accounting_status, created_at)
SELECT 
    p.id,
    'Hazman Enterprise',
    p.email,
    '0123456789',
    'ORG002',
    'active',
    'active',
    NOW()
FROM public.profiles p
WHERE p.email = 'admin@kumim.my'
AND NOT EXISTS (
    SELECT 1 FROM public.organizers o WHERE o.email = 'admin@kumim.my'
);

-- Update existing Hazman organizer record if it exists
UPDATE public.organizers
SET 
    name = 'Hazman Enterprise',
    organizer_code = 'ORG002',
    status = 'active'
WHERE email = 'admin@kumim.my';

-- ============================================================================
-- STEP 2: Create Test Locations for ORG002
-- ============================================================================

-- Get Hazman's organizer ID
DO $$
DECLARE
    hazman_org_id UUID;
    loc1_id UUID;
    loc2_id UUID;
    loc3_id UUID;
BEGIN
    SELECT id INTO hazman_org_id FROM public.organizers WHERE email = 'admin@kumim.my';
    
    IF hazman_org_id IS NULL THEN
        RAISE NOTICE 'Hazman organizer not found!';
        RETURN;
    END IF;

    -- Insert Location 1: Pasar Malam Taman Sri Rampai
    INSERT INTO public.locations (
        name, program_name, type, operating_days, days_per_week, 
        total_lots, rate_khemah, rate_cbs, rate_monthly,
        rate_monthly_khemah, rate_monthly_cbs,
        status, organizer_id, created_at
    ) VALUES (
        'Pasar Malam Taman Sri Rampai',
        'Pasar Malam Komuniti',
        'daily',
        'Sabtu & Ahad',
        2,
        50,
        35.00,
        25.00,
        0,
        0,
        0,
        'active',
        hazman_org_id,
        NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO loc1_id;

    -- Insert Location 2: Bazaar Ramadan Setiawangsa
    INSERT INTO public.locations (
        name, program_name, type, operating_days, days_per_week, 
        total_lots, rate_khemah, rate_cbs, rate_monthly,
        rate_monthly_khemah, rate_monthly_cbs,
        status, organizer_id, created_at
    ) VALUES (
        'Bazaar Ramadan Setiawangsa',
        'Bazaar Ramadan 2025',
        'daily',
        'Isnin - Ahad',
        7,
        80,
        50.00,
        35.00,
        0,
        0,
        0,
        'active',
        hazman_org_id,
        NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO loc2_id;

    -- Insert Location 3: Pusat Penjaja Wangsa Maju (Monthly)
    INSERT INTO public.locations (
        name, program_name, type, operating_days, days_per_week, 
        total_lots, rate_khemah, rate_cbs, rate_monthly,
        rate_monthly_khemah, rate_monthly_cbs,
        status, organizer_id, created_at
    ) VALUES (
        'Pusat Penjaja Wangsa Maju',
        'Tapak Penjaja Tetap',
        'monthly',
        'Isnin - Ahad',
        30,
        20,
        0,
        0,
        300.00,
        150.00,
        100.00,
        'active',
        hazman_org_id,
        NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO loc3_id;

    -- ============================================================================
    -- STEP 3: Create Test Tenants for ORG002
    -- ============================================================================

    -- Create profile and tenant for Ahmad (if not exists)
    INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at)
    VALUES (
        gen_random_uuid(),
        'ahmad.peniaga@example.com',
        'Ahmad Bin Abdullah',
        'tenant',
        'ORG002',
        NOW()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Insert tenant record for Ahmad
    INSERT INTO public.tenants (
        profile_id, full_name, business_name, business_type, 
        phone, email, ic_number, lot_number, 
        rental_type, rental_amount, organizer_code,
        status, created_at
    )
    SELECT 
        p.id,
        'Ahmad Bin Abdullah',
        'Nasi Lemak Sedap',
        'Makanan',
        '0198765432',
        'ahmad.peniaga@example.com',
        '850612105234',
        'L01-K04',
        'daily_khemah',
        35.00,
        'ORG002',
        'active',
        NOW()
    FROM public.profiles p
    WHERE p.email = 'ahmad.peniaga@example.com'
    AND NOT EXISTS (
        SELECT 1 FROM public.tenants t WHERE t.email = 'ahmad.peniaga@example.com'
    );

    -- Create profile and tenant for Sarah
    INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at)
    VALUES (
        gen_random_uuid(),
        'sarah.peniaga@example.com',
        'Sarah Binti Ismail',
        'tenant',
        'ORG002',
        NOW()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Insert tenant record for Sarah
    INSERT INTO public.tenants (
        profile_id, full_name, business_name, business_type, 
        phone, email, ic_number, lot_number, 
        rental_type, rental_amount, organizer_code,
        status, created_at
    )
    SELECT 
        p.id,
        'Sarah Binti Ismail',
        'Baju Kurung Sarah',
        'Pakaian',
        '0167890123',
        'sarah.peniaga@example.com',
        '900305115678',
        'L02-B12',
        'daily_cbs',
        25.00,
        'ORG002',
        'active',
        NOW()
    FROM public.profiles p
    WHERE p.email = 'sarah.peniaga@example.com'
    AND NOT EXISTS (
        SELECT 1 FROM public.tenants t WHERE t.email = 'sarah.peniaga@example.com'
    );

    -- Create profile and tenant for Raj (Monthly)
    INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at)
    VALUES (
        gen_random_uuid(),
        'raj.peniaga@example.com',
        'Raj A/L Kumar',
        'tenant',
        'ORG002',
        NOW()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Insert tenant record for Raj
    INSERT INTO public.tenants (
        profile_id, full_name, business_name, business_type, 
        phone, email, ic_number, lot_number, 
        rental_type, rental_amount, organizer_code,
        status, created_at
    )
    SELECT 
        p.id,
        'Raj A/L Kumar',
        'Rojak Mamak Raj',
        'Makanan',
        '0178901234',
        'raj.peniaga@example.com',
        '880712104567',
        'L03-M05',
        'monthly',
        300.00,
        'ORG002',
        'active',
        NOW()
    FROM public.profiles p
    WHERE p.email = 'raj.peniaga@example.com'
    AND NOT EXISTS (
        SELECT 1 FROM public.tenants t WHERE t.email = 'raj.peniaga@example.com'
    );

    -- ============================================================================
    -- STEP 4: Create Test Transactions
    -- ============================================================================

    -- Get tenant IDs
    DECLARE
        ahmad_id UUID;
        sarah_id UUID;
        raj_id UUID;
    BEGIN
        SELECT id INTO ahmad_id FROM public.tenants WHERE email = 'ahmad.peniaga@example.com';
        SELECT id INTO sarah_id FROM public.tenants WHERE email = 'sarah.peniaga@example.com';
        SELECT id INTO raj_id FROM public.tenants WHERE email = 'raj.peniaga@example.com';

        -- Insert transactions for Ahmad
        IF ahmad_id IS NOT NULL THEN
            INSERT INTO public.transactions (tenant_id, type, amount, date, status, description, created_at)
            VALUES 
                (ahmad_id, 'rental', 35.00, CURRENT_DATE - INTERVAL '2 days', 'paid', 'Sewa 2 hari lepas', NOW()),
                (ahmad_id, 'rental', 35.00, CURRENT_DATE - INTERVAL '5 days', 'paid', 'Sewa minggu lepas', NOW()),
                (ahmad_id, 'compound', 50.00, CURRENT_DATE - INTERVAL '10 days', 'paid', 'Kompaun tapak kotor', NOW())
            ON CONFLICT DO NOTHING;
        END IF;

        -- Insert transactions for Sarah
        IF sarah_id IS NOT NULL THEN
            INSERT INTO public.transactions (tenant_id, type, amount, date, status, description, created_at)
            VALUES 
                (sarah_id, 'rental', 25.00, CURRENT_DATE - INTERVAL '1 day', 'paid', 'Sewa semalam', NOW()),
                (sarah_id, 'rental', 25.00, CURRENT_DATE - INTERVAL '3 days', 'paid', 'Sewa 3 hari lepas', NOW())
            ON CONFLICT DO NOTHING;
        END IF;

        -- Insert transactions for Raj (monthly)
        IF raj_id IS NOT NULL THEN
            INSERT INTO public.transactions (tenant_id, type, amount, date, status, description, created_at)
            VALUES 
                (raj_id, 'rental', 300.00, CURRENT_DATE - INTERVAL '5 days', 'paid', 'Sewa bulanan Januari', NOW()),
                (raj_id, 'rental', 300.00, CURRENT_DATE - INTERVAL '35 days', 'paid', 'Sewa bulanan Disember', NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END;

END $$;

-- ============================================================================
-- STEP 5: Link Manjaya as Staff to ORG002
-- ============================================================================

-- Ensure manjaya.solution@gmail.com exists as staff under ORG002
UPDATE public.profiles
SET 
    role = 'staff',
    organizer_code = 'ORG002'
WHERE email = 'manjaya.solution@gmail.com';

-- If profile doesn't exist, create it
INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at)
SELECT 
    gen_random_uuid(),
    'manjaya.solution@gmail.com',
    'Manjaya Solution',
    'staff',
    'ORG002',
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE email = 'manjaya.solution@gmail.com'
);

-- ============================================================================
-- STEP 6: Verify Results
-- ============================================================================

-- Show organizer info
SELECT 'ORGANIZER' as type, email, name, organizer_code, status 
FROM public.organizers 
WHERE email = 'admin@kumim.my';

-- Show staff count
SELECT 'STAFF COUNT' as type, COUNT(*) as count 
FROM public.profiles 
WHERE role = 'staff' AND organizer_code = 'ORG002';

-- Show locations count
SELECT 'LOCATIONS' as type, COUNT(*) as count 
FROM public.locations l
JOIN public.organizers o ON l.organizer_id = o.id
WHERE o.organizer_code = 'ORG002';

-- Show tenants count
SELECT 'TENANTS' as type, COUNT(*) as count 
FROM public.tenants 
WHERE organizer_code = 'ORG002';

-- Show transactions count
SELECT 'TRANSACTIONS' as type, COUNT(*) as count 
FROM public.transactions t
JOIN public.tenants tn ON t.tenant_id = tn.id
WHERE tn.organizer_code = 'ORG002';
