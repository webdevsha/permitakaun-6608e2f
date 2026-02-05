-- Debug organizer@permit.com Akaun access

SELECT '=== ORGANIZER@PERMIT.COM PROFILE ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at
FROM profiles p
WHERE p.email = 'organizer@permit.com';

SELECT '=== ORGANIZER RECORD ===' as section;
SELECT 
    o.id,
    o.profile_id,
    o.organizer_code,
    o.name,
    o.accounting_status,
    o.status
FROM organizers o
WHERE o.profile_id = (SELECT id FROM profiles WHERE email = 'organizer@permit.com');

SELECT '=== VERIFY ORGANIZER BY CODE ===' as section;
SELECT 
    o.id,
    o.profile_id,
    o.organizer_code,
    o.name,
    o.accounting_status,
    p.email as linked_email
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
WHERE o.organizer_code = 'ORG003';
