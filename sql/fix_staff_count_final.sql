-- FINAL FIX: Ensure correct staff count for each organizer
-- This script fixes the staff count issue by updating/removing duplicate staff

-- ============================================================================
-- STEP 1: Diagnostic - Show current state
-- ============================================================================
SELECT '=== CURRENT STAFF STATE ===' as info;

SELECT 
    p.organizer_code,
    COUNT(*) as staff_count,
    STRING_AGG(p.email, ' | ') as staff_emails
FROM profiles p
WHERE p.role = 'staff'
GROUP BY p.organizer_code
ORDER BY p.organizer_code;

-- ============================================================================
-- STEP 2: Fix ORG001 - ensure only staff@permit.com
-- ============================================================================

-- Update any other staff for ORG001 to tenant role
UPDATE profiles
SET role = 'tenant',
    updated_at = NOW()
WHERE role = 'staff'
AND organizer_code = 'ORG001'
AND email != 'staff@permit.com';

-- ============================================================================
-- STEP 3: Fix ORG002 - ensure only manjaya.solution@gmail.com
-- ============================================================================

-- Update any other staff for ORG002 to tenant role
UPDATE profiles
SET role = 'tenant',
    updated_at = NOW()
WHERE role = 'staff'
AND organizer_code = 'ORG002'
AND email != 'manjaya.solution@gmail.com';

-- ============================================================================
-- STEP 4: Ensure the correct staff have proper organizer codes
-- ============================================================================

-- Fix staff@permit.com
UPDATE profiles
SET organizer_code = 'ORG001',
    role = 'staff',
    full_name = 'Staff Permit',
    updated_at = NOW()
WHERE email = 'staff@permit.com'
AND (organizer_code != 'ORG001' OR role != 'staff' OR full_name IS NULL);

-- Fix manjaya.solution@gmail.com
UPDATE profiles
SET organizer_code = 'ORG002',
    role = 'staff',
    full_name = 'Staff Encik Hazman',
    updated_at = NOW()
WHERE email = 'manjaya.solution@gmail.com'
AND (organizer_code != 'ORG002' OR role != 'staff' OR full_name IS NULL);

-- ============================================================================
-- STEP 5: Verify final state
-- ============================================================================
SELECT '=== FINAL STAFF STATE ===' as info;

SELECT 
    p.organizer_code,
    COUNT(*) as staff_count,
    STRING_AGG(p.email, ' | ') as staff_emails
FROM profiles p
WHERE p.role = 'staff'
GROUP BY p.organizer_code
ORDER BY p.organizer_code;

-- Show detailed staff info
SELECT 
    'STAFF DETAILS' as info,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code,
    p.created_at
FROM profiles p
WHERE p.role = 'staff'
ORDER BY p.organizer_code, p.email;
