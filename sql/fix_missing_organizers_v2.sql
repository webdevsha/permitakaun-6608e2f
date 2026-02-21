-- ============================================================================
-- FIX: Restore Missing Organizers (Version 2 - Fixed ON CONFLICT)
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure profiles exist for missing organizers
-- ============================================================================

-- Create profile for Shafira if not exists
INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at, updated_at)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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

-- Create profile for Kumim if not exists  
INSERT INTO public.profiles (id, email, full_name, role, organizer_code, created_at, updated_at)
VALUES (
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
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
-- STEP 2: Delete existing records if they exist (to avoid conflicts)
-- ============================================================================

-- Delete Shafira if exists (by email to avoid PK issues)
DELETE FROM public.organizers WHERE email = 'hai@shafiranoh.com';

-- Delete Kumim if exists (by email to avoid PK issues)  
DELETE FROM public.organizers WHERE email = 'admin@kumim.my';

-- ============================================================================
-- STEP 3: Insert missing organizers
-- ============================================================================

-- Insert Shafira Orgs (ORG1001)
INSERT INTO public.organizers (
    id,
    profile_id,
    name,
    email,
    organizer_code,
    status,
    accounting_status,
    created_at,
    updated_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Shafira Orgs',
    'hai@shafiranoh.com',
    'ORG1001',
    'active',
    'active',
    NOW(),
    NOW()
);

-- Insert Kumim Sdn Bhd (ORG002)
INSERT INTO public.organizers (
    id,
    profile_id,
    name,
    email,
    organizer_code,
    status,
    accounting_status,
    created_at,
    updated_at
) VALUES (
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    'Kumim Sdn Bhd',
    'admin@kumim.my',
    'ORG002',
    'active',
    'active',
    NOW(),
    NOW()
);

-- ============================================================================
-- STEP 4: Update sequence to not reuse existing codes
-- ============================================================================
SELECT setval('organizer_code_seq', GREATEST(
    (SELECT MAX(CAST(REPLACE(organizer_code, 'ORG', '') AS INTEGER)) FROM public.organizers WHERE organizer_code ~ '^ORG[0-9]+$'),
    1000
));

-- ============================================================================
-- STEP 5: Verify all organizers exist
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
