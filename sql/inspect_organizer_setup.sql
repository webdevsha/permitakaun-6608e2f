-- =============================================================================
-- INSPECT ORGANIZER SETUP
-- Check the current state of organizers, their tenants, and locations
-- =============================================================================

-- 1. Check organizers table structure and data
SELECT '=== ORGANIZERS TABLE ===' as section;
SELECT 
    o.id,
    o.profile_id,
    o.name,
    o.email,
    o.organizer_code,
    (SELECT COUNT(*) FROM locations l WHERE l.organizer_id = o.id) as location_count,
    (SELECT COUNT(*) FROM tenants t WHERE t.organizer_code = o.organizer_code) as tenant_count
FROM organizers o
ORDER BY o.organizer_code;

-- 2. Check which profiles are organizers
SELECT '=== PROFILES WITH ORGANIZER ROLE ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.organizer_code,
    o.id as organizer_table_id,
    o.name as organizer_name
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.role = 'organizer';

-- 3. Check locations and their organizers
SELECT '=== LOCATIONS BY ORGANIZER ===' as section;
SELECT 
    l.id,
    l.name as location_name,
    l.organizer_id,
    o.name as organizer_name,
    o.organizer_code,
    (SELECT COUNT(*) FROM tenant_locations tl WHERE tl.location_id = l.id AND tl.status = 'active') as active_tenants
FROM locations l
JOIN organizers o ON o.id = l.organizer_id
ORDER BY o.organizer_code, l.name;

-- 4. Check tenants and their organizer linkage
SELECT '=== TENANTS BY ORGANIZER CODE ===' as section;
SELECT 
    t.organizer_code,
    o.name as organizer_name,
    COUNT(*) as tenant_count,
    STRING_AGG(t.full_name, ', ' ORDER BY t.full_name) as tenant_names
FROM tenants t
LEFT JOIN organizers o ON o.organizer_code = t.organizer_code
GROUP BY t.organizer_code, o.name
ORDER BY t.organizer_code;

-- 5. Check for orphaned tenants (no matching organizer)
SELECT '=== TENANTS WITH INVALID ORGANIZER CODE ===' as section;
SELECT 
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    '❌ No matching organizer' as issue
FROM tenants t
WHERE t.organizer_code IS NOT NULL
  AND t.organizer_code NOT IN (SELECT organizer_code FROM organizers)
ORDER BY t.organizer_code;

-- 6. Check tenant_locations (which tenants are assigned to which locations)
SELECT '=== TENANT LOCATIONS ===' as section;
SELECT 
    tl.tenant_id,
    t.full_name as tenant_name,
    tl.location_id,
    l.name as location_name,
    o.name as organizer_name,
    tl.status,
    tl.rate_type
FROM tenant_locations tl
JOIN tenants t ON t.id = tl.tenant_id
JOIN locations l ON l.id = tl.location_id
JOIN organizers o ON o.id = l.organizer_id
ORDER BY o.name, l.name, t.full_name
LIMIT 20;

-- 7. Summary stats
SELECT '=== SUMMARY ===' as section;
SELECT 
    (SELECT COUNT(*) FROM organizers) as total_organizers,
    (SELECT COUNT(*) FROM locations) as total_locations,
    (SELECT COUNT(*) FROM tenants) as total_tenants,
    (SELECT COUNT(*) FROM tenant_locations WHERE status = 'active') as active_rentals,
    (SELECT COUNT(DISTINCT organizer_code) FROM tenants WHERE organizer_code IS NOT NULL) as tenants_with_org;
