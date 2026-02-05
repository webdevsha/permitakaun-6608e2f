-- Check who owns ORG003

SELECT '=== ORG003 ORGANIZER ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    o.email
FROM organizers o
WHERE o.organizer_code = 'ORG003';

SELECT '=== PROFILES WITH ORG003 ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code
FROM profiles p
WHERE p.organizer_code = 'ORG003';

SELECT '=== ORG003 TENANT ===' as section;
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    t.business_name
FROM tenants t
WHERE t.organizer_code = 'ORG003';

SELECT '=== ALL ORGANIZERS WITH PROFILE LINKS ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    p.email as profile_email,
    p.full_name as profile_name,
    CASE 
        WHEN o.profile_id IS NULL THEN '❌ No profile link'
        WHEN o.profile_id != p.id THEN '⚠️ Mismatch'
        ELSE '✅ Linked'
    END as status
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;
