-- Final verification of the complete architecture

SELECT '========== ROLE ASSIGNMENT SUMMARY ==========' as section;
SELECT 
    'Superadmin' as role,
    (SELECT STRING_AGG(email, ', ') FROM profiles WHERE role = 'superadmin') as users
UNION ALL
SELECT 
    'Admin' as role,
    (SELECT STRING_AGG(email, ', ') FROM profiles WHERE role = 'admin') as users
UNION ALL
SELECT 
    'Staff' as role,
    (SELECT STRING_AGG(email, ', ') FROM profiles WHERE role = 'staff') as users
UNION ALL
SELECT 
    'Organizer' as role,
    (SELECT STRING_AGG(email, ', ') FROM profiles WHERE role = 'organizer') as users;

SELECT '========== ADMIN → STAFF MAPPING ==========' as section;
SELECT 
    a.email as admin_email,
    a.organizer_code as admin_org,
    STRING_AGG(s.email, ', ') as staff_emails,
    COUNT(s.id) as staff_count,
    a.max_staff_count as max_allowed
FROM admins a
LEFT JOIN staff s ON s.admin_id = a.id
GROUP BY a.id, a.email, a.organizer_code, a.max_staff_count
ORDER BY a.organizer_code;

SELECT '========== ORGANIZER → TENANTS ==========' as section;
SELECT 
    o.organizer_code,
    o.name as organizer_name,
    p.email as owner_email,
    (SELECT COUNT(*) FROM locations l WHERE l.organizer_id = o.id) as locations,
    (SELECT COUNT(*) FROM tenants t WHERE t.organizer_code = o.organizer_code) as tenants
FROM organizers o
LEFT JOIN profiles p ON p.id = o.profile_id
ORDER BY o.organizer_code;

SELECT '========== DATA ACCESS MATRIX ==========' as section;
-- Who can access what
SELECT 
    p.email,
    p.role,
    p.organizer_code,
    CASE p.role
        WHEN 'admin' THEN 'Can access all data in their organizer_code (or all if NULL)'
        WHEN 'staff' THEN 'Mirrors admin access via staff.organizer_code'
        WHEN 'organizer' THEN 'Can only access their own organizer_code data'
        WHEN 'tenant' THEN 'Can only access their own tenant data'
        ELSE 'Limited access'
    END as access_scope,
    CASE p.role
        WHEN 'admin' THEN (SELECT organizer_code FROM admins WHERE profile_id = p.id)
        WHEN 'staff' THEN (SELECT organizer_code FROM staff WHERE profile_id = p.id)
        ELSE p.organizer_code
    END as effective_org_code
FROM profiles p
WHERE p.role IN ('admin', 'staff', 'organizer')
ORDER BY p.role, p.email;

SELECT '========== ORPHANED/DEMO DATA ==========' as section;
-- These are demo/seed data that don't need profile links
SELECT 
    o.organizer_code,
    o.name,
    'Demo/Seed data - no profile needed' as note
FROM organizers o
WHERE o.profile_id IS NULL
ORDER BY o.organizer_code;
