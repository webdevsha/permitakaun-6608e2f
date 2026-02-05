-- DEBUG: Find why staff count is 2 for ORG002

-- 1. Show ALL staff with their organizer codes
SELECT 
    'ALL STAFF' as check_type,
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code,
    p.created_at
FROM profiles p
WHERE p.role = 'staff'
ORDER BY p.organizer_code, p.email;

-- 2. Show staff specifically for ORG002
SELECT 
    'ORG002 STAFF' as check_type,
    p.id,
    p.email,
    p.full_name,
    p.organizer_code
FROM profiles p
WHERE p.role = 'staff'
AND p.organizer_code = 'ORG002';

-- 3. Check if there are any profiles with null/empty organizer_code that might be staff
SELECT 
    'STAFF WITH NULL ORGCODE' as check_type,
    p.id,
    p.email,
    p.full_name,
    p.organizer_code
FROM profiles p
WHERE p.role = 'staff'
AND (p.organizer_code IS NULL OR p.organizer_code = '');

-- 4. Check organizers table to see which codes exist
SELECT 
    'ORGANIZERS' as check_type,
    o.id,
    o.name,
    o.organizer_code,
    o.profile_id
FROM organizers o
ORDER BY o.organizer_code;

-- 5. If there's a duplicate staff for ORG002, this will identify it
-- Show detailed info for potential duplicates
SELECT 
    'POTENTIAL DUPLICATES' as check_type,
    p.organizer_code,
    COUNT(*) as staff_count,
    STRING_AGG(p.email, ', ') as emails
FROM profiles p
WHERE p.role = 'staff'
GROUP BY p.organizer_code
HAVING COUNT(*) > 1;

-- 6. Show admin for ORG002
SELECT 
    'ORG002 ADMIN' as check_type,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code
FROM profiles p
WHERE p.organizer_code = 'ORG002'
AND p.role = 'admin';
