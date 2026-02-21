-- ============================================================================
-- FIX: Restore Missing Organizers (Version 4 - Fixed Columns)
-- ============================================================================

-- ============================================================================
-- STEP 1: Get or create auth users for Shafira and Kumim
-- ============================================================================

DO $$
DECLARE
    shafira_id UUID;
    kumim_id UUID;
BEGIN
    -- Check if Shafira user exists in auth.users
    SELECT id INTO shafira_id 
    FROM auth.users 
    WHERE email = 'hai@shafiranoh.com';
    
    -- Check if Kumim user exists in auth.users
    SELECT id INTO kumim_id 
    FROM auth.users 
    WHERE email = 'admin@kumim.my';
    
    -- Generate UUIDs if users don't exist
    IF shafira_id IS NULL THEN
        shafira_id := gen_random_uuid();
        
        -- Insert into auth.users
        INSERT INTO auth.users (
            id,
            email,
            raw_user_meta_data,
            email_confirmed_at,
            created_at,
            updated_at
        ) VALUES (
            shafira_id,
            'hai@shafiranoh.com',
            '{"role": "organizer", "full_name": "Shafira Orgs"}'::jsonb,
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id INTO shafira_id;
        
        RAISE NOTICE 'Created auth user for Shafira: %', shafira_id;
    ELSE
        RAISE NOTICE 'Found existing Shafira auth user: %', shafira_id;
    END IF;
    
    IF kumim_id IS NULL THEN
        kumim_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            email,
            raw_user_meta_data,
            email_confirmed_at,
            created_at,
            updated_at
        ) VALUES (
            kumim_id,
            'admin@kumim.my',
            '{"role": "organizer", "full_name": "Kumim Sdn Bhd"}'::jsonb,
            NOW(),
            NOW(),
            NOW()
        )
        ON CONFLICT (email) DO NOTHING
        RETURNING id INTO kumim_id;
        
        RAISE NOTICE 'Created auth user for Kumim: %', kumim_id;
    ELSE
        RAISE NOTICE 'Found existing Kumim auth user: %', kumim_id;
    END IF;
    
    -- ============================================================================
    -- STEP 2: Ensure profiles exist
    -- ============================================================================
    
    -- Insert Shafira profile
    INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at, updated_at)
    VALUES (
        shafira_id,
        'hai@shafiranoh.com',
        'Shafira Orgs',
        'organizer',
        'ORG1001',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'organizer',
        organizer_code = 'ORG1001',
        updated_at = NOW();
    
    -- Insert Kumim profile
    INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at, updated_at)
    VALUES (
        kumim_id,
        'admin@kumim.my',
        'Kumim Sdn Bhd',
        'organizer',
        'ORG002',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'organizer',
        organizer_code = 'ORG002',
        updated_at = NOW();
    
    -- ============================================================================
    -- STEP 3: Delete existing organizers if any
    -- ============================================================================
    
    DELETE FROM public.organizers WHERE email = 'hai@shafiranoh.com';
    DELETE FROM public.organizers WHERE email = 'admin@kumim.my';
    
    -- ============================================================================
    -- STEP 4: Insert organizers (WITHOUT updated_at - column doesn't exist)
    -- ============================================================================
    
    -- Insert Shafira Orgs
    INSERT INTO public.organizers (
        id,
        profile_id,
        name,
        email,
        organizer_code,
        status,
        accounting_status,
        created_at
    ) VALUES (
        shafira_id,
        shafira_id,
        'Shafira Orgs',
        'hai@shafiranoh.com',
        'ORG1001',
        'active',
        'active',
        NOW()
    );
    
    -- Insert Kumim
    INSERT INTO public.organizers (
        id,
        profile_id,
        name,
        email,
        organizer_code,
        status,
        accounting_status,
        created_at
    ) VALUES (
        kumim_id,
        kumim_id,
        'Kumim Sdn Bhd',
        'admin@kumim.my',
        'ORG002',
        'active',
        'active',
        NOW()
    );
    
    RAISE NOTICE 'Successfully created/updated organizers';
END $$;

-- ============================================================================
-- STEP 5: Update sequence
-- ============================================================================
SELECT setval('organizer_code_seq', GREATEST(
    (SELECT MAX(CAST(REPLACE(organizer_code, 'ORG', '') AS INTEGER)) FROM public.organizers WHERE organizer_code ~ '^ORG[0-9]+$'),
    1000
));

-- ============================================================================
-- STEP 6: Verify
-- ============================================================================
SELECT 
    id,
    name,
    email,
    organizer_code,
    status,
    accounting_status
FROM public.organizers
ORDER BY organizer_code;
