-- ============================================================================
-- FIX: Restore Missing Organizers
-- ============================================================================
-- The organizers table is missing Shafira Orgs (ORG1001) and Kumim (ORG002)
-- This SQL restores them with proper data

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
ON CONFLICT (email) DO UPDATE
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
ON CONFLICT (email) DO UPDATE
SET role = 'organizer',
    organizer_code = 'ORG002',
    updated_at = NOW();

-- ============================================================================
-- STEP 2: Insert missing organizers
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
)
ON CONFLICT (id) DO UPDATE
SET name = 'Shafira Orgs',
    organizer_code = 'ORG1001',
    status = 'active',
    accounting_status = 'active',
    updated_at = NOW();

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
)
ON CONFLICT (id) DO UPDATE
SET name = 'Kumim Sdn Bhd',
    organizer_code = 'ORG002',
    status = 'active',
    accounting_status = 'active',
    updated_at = NOW();

-- ============================================================================
-- STEP 3: Update sequence to not reuse existing codes
-- ============================================================================
SELECT setval('organizer_code_seq', GREATEST(
    (SELECT MAX(CAST(REPLACE(organizer_code, 'ORG', '') AS INTEGER)) FROM public.organizers WHERE organizer_code ~ '^ORG[0-9]+$'),
    1000
));

-- ============================================================================
-- STEP 4: Verify all organizers exist
-- ============================================================================
SELECT 
    'ORGANIZERS COUNT' as check_type,
    COUNT(*) as count
FROM public.organizers
UNION ALL
SELECT 
    'ORGANIZERS LIST',
    STRING_AGG(name || ' (' || organizer_code || ')', ', ')
FROM public.organizers;
