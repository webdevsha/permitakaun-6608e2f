-- Find organizers without profile links
SELECT '=== ORGANIZERS WITHOUT PROFILE LINK ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    o.email
FROM organizers o
WHERE o.profile_id IS NULL
ORDER BY o.organizer_code;

-- Find profiles that might match by email or code
SELECT '=== POTENTIAL MATCHES ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code
FROM profiles p
WHERE p.role = 'organizer'
   OR p.email LIKE '%organizer%'
   OR p.organizer_code IN ('ORG001', 'ORG002', 'ORG003')
ORDER BY p.organizer_code, p.email;

-- Fix: Link organizers to profiles based on organizer_code
UPDATE organizers o
SET profile_id = p.id
FROM profiles p
WHERE o.profile_id IS NULL
  AND p.role = 'organizer'
  AND p.organizer_code = o.organizer_code;

-- Verify fix
SELECT '=== AFTER FIX ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    p.email as linked_email
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;
