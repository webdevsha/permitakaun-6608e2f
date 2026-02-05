-- Test query to verify staff-admin links are correct

SELECT '=== STAFF-ADMIN LINKAGE TEST ===' as test_name;

SELECT 
    s.email as staff_email,
    s.full_name as staff_name,
    s.organizer_code as staff_org_code,
    a.email as admin_email,
    a.full_name as admin_name,
    a.organizer_code as admin_org_code,
    CASE 
        WHEN s.admin_id IS NULL THEN '❌ NO ADMIN LINK'
        WHEN s.organizer_code = a.organizer_code THEN '✅ MATCH'
        ELSE '⚠️ MISMATCH - Staff: ' || s.organizer_code || ', Admin: ' || COALESCE(a.organizer_code, 'NULL')
    END as link_status
FROM staff s
LEFT JOIN admins a ON a.id = s.admin_id
ORDER BY s.organizer_code, s.email;

SELECT '=== ADMIN WITH STAFF COUNT ===' as test_name;
SELECT 
    a.email as admin_email,
    a.organizer_code,
    a.max_staff_count as allowed_staff,
    (SELECT COUNT(*) FROM staff s WHERE s.admin_id = a.id) as actual_staff,
    CASE 
        WHEN (SELECT COUNT(*) FROM staff s WHERE s.admin_id = a.id) > a.max_staff_count 
        THEN '⚠️ OVER LIMIT' 
        ELSE '✅ OK' 
    END as limit_status
FROM admins a
ORDER BY a.organizer_code;

SELECT '=== ORPHANED STAFF (No Admin) ===' as test_name;
SELECT 
    s.email,
    s.full_name,
    s.organizer_code,
    '❌ No admin linked' as issue
FROM staff s
WHERE s.admin_id IS NULL;
