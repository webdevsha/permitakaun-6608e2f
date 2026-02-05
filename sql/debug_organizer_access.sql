-- Debug organizer@permit.com access issues

SELECT '=== ORGANIZER@PERMIT.COM PROFILE ===' as section;
SELECT 
    p.id,
    p.email,
    p.role,
    p.organizer_code,
    p.full_name
FROM profiles p
WHERE p.email = 'organizer@permit.com';

SELECT '=== ORG003 ORGANIZER RECORD ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id
FROM organizers o
WHERE o.organizer_code = 'ORG003';

SELECT '=== TENANTS WITH ORG003 ===' as section;
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    t.status,
    t.profile_id
FROM tenants t
WHERE t.organizer_code = 'ORG003'
ORDER BY t.full_name;

SELECT '=== LOCATIONS FOR ORG003 ===' as section;
SELECT 
    l.id,
    l.name,
    l.organizer_id,
    o.organizer_code,
    o.name as organizer_name
FROM locations l
JOIN organizers o ON o.id = l.organizer_id
WHERE o.organizer_code = 'ORG003';

SELECT '=== TRANSACTIONS FOR ORG003 TENANTS ===' as section;
SELECT 
    tx.id,
    tx.tenant_id,
    t.full_name as tenant_name,
    tx.amount,
    tx.date,
    tx.type
FROM transactions tx
JOIN tenants t ON t.id = tx.tenant_id
WHERE t.organizer_code = 'ORG003'
ORDER BY tx.date DESC
LIMIT 10;
