-- VERIFY: Staff setup for both staff members
-- Run this to check current configuration

-- ============================================================================
-- STAFF 1: staff@permit.com (should mirror admin@permit.com / ORG001)
-- ============================================================================

SELECT '=== STAFF 1: staff@permit.com ===' as section;

-- Check staff profile
SELECT 
    'Profile' as check_type,
    p.id, p.email, p.full_name, p.role, p.organizer_code
FROM profiles p
WHERE p.email = 'staff@permit.com';

-- What organizers should staff@permit.com see?
SELECT 
    'Visible Organizers' as check_type,
    o.id, o.name, o.organizer_code
FROM organizers o
WHERE o.organizer_code = 'ORG001';

-- What tenants should staff@permit.com see?
SELECT 
    'Visible Tenants' as check_type,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ') as tenant_names
FROM tenants t
WHERE t.organizer_code = 'ORG001';

-- What users should staff@permit.com see in Pengurusan Pengguna?
SELECT 
    'Visible Users' as check_type,
    p.email, p.full_name, p.role
FROM profiles p
WHERE p.organizer_code = 'ORG001'
AND p.role != 'superadmin'
ORDER BY p.role, p.email;

-- ============================================================================
-- STAFF 2: manjaya.solution@gmail.com (should mirror admin@kumim.my / ORG002)
-- ============================================================================

SELECT '=== STAFF 2: manjaya.solution@gmail.com ===' as section;

-- Check staff profile
SELECT 
    'Profile' as check_type,
    p.id, p.email, p.full_name, p.role, p.organizer_code
FROM profiles p
WHERE p.email = 'manjaya.solution@gmail.com';

-- What organizers should manjaya.solution see?
SELECT 
    'Visible Organizers' as check_type,
    o.id, o.name, o.organizer_code
FROM organizers o
WHERE o.organizer_code = 'ORG002';

-- What tenants should manjaya.solution see?
SELECT 
    'Visible Tenants' as check_type,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ') as tenant_names
FROM tenants t
WHERE t.organizer_code = 'ORG002';

-- What users should manjaya.solution see in Pengurusan Pengguna?
SELECT 
    'Visible Users' as check_type,
    p.email, p.full_name, p.role
FROM profiles p
WHERE p.organizer_code = 'ORG002'
AND p.role != 'superadmin'
ORDER BY p.role, p.email;

-- ============================================================================
-- CHECK: Are tenants correctly assigned to organizers?
-- ============================================================================

SELECT '=== TENANT ASSIGNMENTS ===' as section;

SELECT 
    t.organizer_code,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ' ORDER BY t.full_name) as tenants
FROM tenants t
WHERE t.organizer_code IN ('ORG001', 'ORG002')
GROUP BY t.organizer_code;

-- ============================================================================
-- CHECK: Are there tenants WITHOUT organizer_code?
-- ============================================================================

SELECT '=== TENANTS WITHOUT ORGANIZER CODE ===' as section;

SELECT 
    t.id, t.full_name, t.business_name, t.organizer_code
FROM tenants t
WHERE t.organizer_code IS NULL OR t.organizer_code = ''
LIMIT 10;
