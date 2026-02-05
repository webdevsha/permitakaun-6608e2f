-- Verify migration results and check current state

-- 1. Check profiles with their roles and organizer_codes
SELECT '=== PROFILES BY ROLE ===' as section;
SELECT 
    p.role,
    COUNT(*) as count,
    STRING_AGG(p.email, ', ') as emails,
    STRING_AGG(COALESCE(p.organizer_code, 'NULL'), ', ') as organizer_codes
FROM profiles p
GROUP BY p.role
ORDER BY p.role;

-- 2. Check admins table
SELECT '=== ADMINS TABLE ===' as section;
SELECT 
    a.id,
    a.email,
    a.full_name,
    a.organizer_code,
    a.max_staff_count,
    (SELECT COUNT(*) FROM staff s WHERE s.admin_id = a.id) as linked_staff_count
FROM admins a
ORDER BY a.organizer_code;

-- 3. Check staff table
SELECT '=== STAFF TABLE ===' as section;
SELECT 
    s.id,
    s.email,
    s.full_name,
    s.organizer_code,
    s.admin_id,
    a.email as admin_email,
    s.can_approve
FROM staff s
LEFT JOIN admins a ON a.id = s.admin_id
ORDER BY s.organizer_code, s.email;

-- 4. Check organizers
SELECT '=== ORGANIZERS TABLE ===' as section;
SELECT 
    o.id,
    o.name,
    o.organizer_code,
    o.email,
    (SELECT COUNT(*) FROM tenants t WHERE t.organizer_id = o.id) as tenant_count
FROM organizers o
ORDER BY o.organizer_code;

-- 5. Check tenants by organizer
SELECT '=== TENANTS BY ORGANIZER ===' as section;
SELECT 
    o.organizer_code,
    o.name as organizer_name,
    COUNT(t.id) as tenant_count,
    STRING_AGG(t.business_name, ', ' ORDER BY t.business_name) as tenant_names
FROM organizers o
LEFT JOIN tenants t ON t.organizer_id = o.id
GROUP BY o.id, o.organizer_code, o.name
ORDER BY o.organizer_code;

-- 6. Check profiles that should have been migrated but weren't
SELECT '=== PROFILES NOT IN ADMINS/STAFF YET ===' as section;
SELECT 
    p.id,
    p.email,
    p.role,
    p.organizer_code,
    CASE 
        WHEN p.role = 'admin' THEN 'Should be in admins table'
        WHEN p.role = 'staff' THEN 'Should be in staff table'
        ELSE 'Other role'
    END as expected
FROM profiles p
WHERE p.role IN ('admin', 'staff')
  AND p.id NOT IN (SELECT profile_id FROM admins)
  AND p.id NOT IN (SELECT profile_id FROM staff);

-- 7. Check data counts summary
SELECT '=== DATA SUMMARY ===' as section;
SELECT 
    'profiles' as table_name, 
    (SELECT COUNT(*) FROM profiles) as total,
    (SELECT COUNT(*) FROM profiles WHERE role = 'superadmin') as superadmin,
    (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admin,
    (SELECT COUNT(*) FROM profiles WHERE role = 'staff') as staff,
    (SELECT COUNT(*) FROM profiles WHERE role = 'organizer') as organizer,
    (SELECT COUNT(*) FROM profiles WHERE role = 'tenant') as tenant
UNION ALL
SELECT 
    'admins' as table_name, 
    (SELECT COUNT(*) FROM admins) as total,
    0 as superadmin, 0 as admin, 0 as staff, 0 as organizer, 0 as tenant
UNION ALL
SELECT 
    'staff' as table_name, 
    (SELECT COUNT(*) FROM staff) as total,
    0 as superadmin, 0 as admin, 0 as staff, 0 as organizer, 0 as tenant;
