-- Debug staff data access issues

SELECT '=== STAFF@PERMIT.COM ACCESS CHECK ===' as section;
-- Get staff's organizer_code from staff table
SELECT 
    s.id as staff_id,
    s.email as staff_email,
    s.organizer_code as staff_org_code,
    a.email as admin_email,
    a.organizer_code as admin_org_code
FROM staff s
JOIN admins a ON a.id = s.admin_id
WHERE s.email = 'staff@permit.com';

SELECT '=== WHAT SHOULD STAFF@PERMIT.COM SEE (ORG001) ===' as section;
-- Tenants with ORG001
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    t.status
FROM tenants t
WHERE t.organizer_code = 'ORG001'
ORDER BY t.full_name;

SELECT '=== LOCATIONS FOR ORG001 ===' as section;
SELECT 
    l.id,
    l.name,
    o.organizer_code,
    o.name as organizer_name
FROM locations l
JOIN organizers o ON o.id = l.organizer_id
WHERE o.organizer_code = 'ORG001';

SELECT '=== MANJAYA.SOLUTION@GMAIL.COM ACCESS CHECK ===' as section;
-- Get staff's organizer_code
SELECT 
    s.id as staff_id,
    s.email as staff_email,
    s.organizer_code as staff_org_code,
    a.email as admin_email,
    a.organizer_code as admin_org_code
FROM staff s
JOIN admins a ON a.id = s.admin_id
WHERE s.email = 'manjaya.solution@gmail.com';

SELECT '=== WHAT SHOULD MANJAYA SEE (ORG002) ===' as section;
-- Tenants with ORG002
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    t.status
FROM tenants t
WHERE t.organizer_code = 'ORG002'
ORDER BY t.full_name;

SELECT '=== LOCATIONS FOR ORG002 ===' as section;
SELECT 
    l.id,
    l.name,
    o.organizer_code,
    o.name as organizer_name
FROM locations l
JOIN organizers o ON o.id = l.organizer_id
WHERE o.organizer_code = 'ORG002';
