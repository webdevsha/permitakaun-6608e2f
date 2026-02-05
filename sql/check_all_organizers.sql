-- Check all organizer assignments and relationships

SELECT '=== ALL ORGANIZERS ===' as section;
SELECT 
    o.id,
    o.organizer_code,
    o.name,
    o.profile_id,
    p.email as profile_email,
    p.full_name as profile_name,
    (SELECT COUNT(*) FROM locations l WHERE l.organizer_id = o.id) as location_count,
    (SELECT COUNT(*) FROM tenants t WHERE t.organizer_code = o.organizer_code) as tenant_count
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;

SELECT '=== PROFILES WITH ROLE = ORGANIZER ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.organizer_code,
    o.id as organizer_id,
    o.organizer_code as org_table_code
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.role = 'organizer'
ORDER BY p.email;

SELECT '=== CHECK: organizer@permit.com ===' as section;
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.organizer_code as profile_org_code,
    o.id as organizer_id,
    o.organizer_code as organizer_table_code,
    o.name as organizer_name,
    CASE 
        WHEN o.id IS NULL THEN '❌ No organizer record'
        WHEN o.profile_id != p.id THEN '⚠️ Profile ID mismatch'
        ELSE '✅ Linked correctly'
    END as link_status
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.email = 'organizer@permit.com';

SELECT '=== CHECK: admin@permit.com ===' as section;
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.organizer_code as profile_org_code,
    a.id as admin_id,
    a.organizer_code as admin_table_code,
    o.id as organizer_id,
    o.organizer_code as org_table_code
FROM profiles p
LEFT JOIN admins a ON a.profile_id = p.id
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.email = 'admin@permit.com';

SELECT '=== TENANTS BY ORGANIZER CODE ===' as section;
SELECT 
    t.organizer_code,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ' ORDER BY t.full_name) as tenant_names
FROM tenants t
WHERE t.organizer_code IS NOT NULL
GROUP BY t.organizer_code
ORDER BY t.organizer_code;
