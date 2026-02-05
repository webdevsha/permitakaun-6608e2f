-- FIX: Correct the organizer_code assignments and remove non-tenants
-- Hazman (admin@kumim.my) and Staff Encik Hazman should be ORG002, not ORG001
-- Admins/Organizers/Staff should NOT be in tenants table at all

-- ============================================================================
-- STEP 1: Show current problematic assignments
-- ============================================================================

SELECT 
    'PROBLEMATIC TENANTS' as check_type,
    t.id,
    t.full_name,
    t.email,
    t.organizer_code as current_org_code,
    p.role as profile_role,
    p.organizer_code as profile_org_code,
    CASE 
        WHEN p.role = 'admin' THEN 'Should be ADMIN, not tenant'
        WHEN p.role = 'staff' THEN 'Should be STAFF, not tenant'
        WHEN p.role = 'organizer' THEN 'Should be ORGANIZER, not tenant'
        WHEN p.email = 'admin@kumim.my' THEN 'Hazman - should be ORG002'
        WHEN p.email = 'manjaya.solution@gmail.com' THEN 'Staff - should be ORG002'
        ELSE 'Needs review'
    END as issue
FROM tenants t
JOIN profiles p ON p.id = t.profile_id
WHERE t.email IN ('admin@kumim.my', 'manjaya.solution@gmail.com', 'admin@permit.com', 'organizer@permit.com')
   OR p.role IN ('admin', 'staff', 'organizer');

-- ============================================================================
-- STEP 2: Fix Hazman (admin@kumim.my) - should be ORG002
-- ============================================================================

UPDATE tenants
SET organizer_code = 'ORG002'
WHERE email = 'admin@kumim.my'
AND organizer_code != 'ORG002';

-- ============================================================================
-- STEP 3: Fix Staff Encik Hazman (manjaya.solution@gmail.com) - should be ORG002
-- ============================================================================

UPDATE tenants
SET organizer_code = 'ORG002'
WHERE email = 'manjaya.solution@gmail.com'
AND organizer_code != 'ORG002';

-- ============================================================================
-- STEP 4: Fix Sample (admin@permit.com) - should be ORG001
-- ============================================================================

UPDATE tenants
SET organizer_code = 'ORG001'
WHERE email = 'admin@permit.com'
AND organizer_code != 'ORG001';

-- ============================================================================
-- STEP 5: Fix Demo Organizer (organizer@permit.com) - should be ORG001
-- ============================================================================

UPDATE tenants
SET organizer_code = 'ORG003'
WHERE email = 'organizer@permit.com'
AND organizer_code != 'ORG003';

-- ============================================================================
-- STEP 6: Alternative - DELETE non-tenant records (admins/organizers/staff from tenants table)
-- Uncomment this section if you want to remove them entirely from tenants table
-- ============================================================================

/*
-- Remove admins from tenants table
DELETE FROM tenants
WHERE email IN ('admin@permit.com', 'admin@kumim.my');

-- Remove organizers from tenants table  
DELETE FROM tenants
WHERE email = 'organizer@permit.com';

-- Remove staff from tenants table
DELETE FROM tenants
WHERE email = 'manjaya.solution@gmail.com';
*/

-- ============================================================================
-- STEP 7: Verify fixes
-- ============================================================================

SELECT 
    'AFTER FIX - TENANTS' as check_type,
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    o.name as organizer_name,
    p.role as profile_role
FROM tenants t
LEFT JOIN organizers o ON o.organizer_code = t.organizer_code
LEFT JOIN profiles p ON p.id = t.profile_id
ORDER BY t.organizer_code, t.full_name;

-- ============================================================================
-- STEP 8: Summary by organizer
-- ============================================================================

SELECT 
    'SUMMARY BY ORG' as check_type,
    t.organizer_code,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ' ORDER BY t.full_name) as tenants
FROM tenants t
GROUP BY t.organizer_code
ORDER BY t.organizer_code;
