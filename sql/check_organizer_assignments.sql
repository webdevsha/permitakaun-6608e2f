-- Check actual organizer assignments

SELECT '=== ORGANIZERS AND THEIR ADMINS ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    p.email as organizer_email,
    p.full_name as organizer_name
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;

SELECT '=== PROFILES WITH ORGANIZER ROLE ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.organizer_code,
    o.id as linked_organizer_id,
    o.name as linked_organizer_name
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.role = 'organizer'
ORDER BY p.email;

SELECT '=== ADMINS AND THEIR ORGANIZER_CODES ===' as section;
SELECT 
    a.id,
    a.email,
    a.organizer_code,
    a.full_name
FROM admins a
ORDER BY a.organizer_code;

SELECT '=== VERIFY: organizer@permit.com assignment ===' as section;
SELECT 
    p.id,
    p.email,
    p.role,
    p.organizer_code,
    o.id as organizer_table_id,
    o.organizer_code as organizer_table_code,
    o.name
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.email = 'organizer@permit.com';
