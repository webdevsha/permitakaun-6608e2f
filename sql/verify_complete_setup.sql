-- Complete verification of the new architecture

SELECT '========== ADMINS TABLE ==========' as section;
SELECT 
    a.id,
    a.email,
    a.full_name,
    a.organizer_code,
    a.max_staff_count,
    (SELECT COUNT(*) FROM staff s WHERE s.admin_id = a.id) as staff_count
FROM admins a
ORDER BY a.organizer_code;

SELECT '========== STAFF TABLE ==========' as section;
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
ORDER BY s.organizer_code;

SELECT '========== ORGANIZERS ==========' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    p.email as linked_email
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;

SELECT '========== PROFILES SUMMARY ==========' as section;
SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(email, ', ' ORDER BY email) as emails
FROM profiles
GROUP BY role
ORDER BY role;

SELECT '========== DATA INTEGRITY CHECK ==========' as section;
-- Check for orphaned staff (no admin)
SELECT 
    'Orphaned Staff (no admin link)' as check_type,
    COUNT(*) as count
FROM staff
WHERE admin_id IS NULL
UNION ALL
-- Check for staff without organizer_code
SELECT 
    'Staff without organizer_code' as check_type,
    COUNT(*) as count
FROM staff
WHERE organizer_code IS NULL
UNION ALL
-- Check for organizers without profile
SELECT 
    'Organizers without profile link' as check_type,
    COUNT(*) as count
FROM organizers
WHERE profile_id IS NULL;
