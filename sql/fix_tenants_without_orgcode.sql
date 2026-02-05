-- FIX: Assign organizer_code to tenants that don't have one
-- This script finds tenants without organizer_code and assigns them based on their location rentals

-- ============================================================================
-- STEP 1: Show tenants without organizer_code
-- ============================================================================

SELECT 
    'TENANTS WITHOUT ORGANIZER_CODE' as check_type,
    t.id,
    t.full_name,
    t.business_name,
    t.organizer_code,
    t.profile_id,
    t.email
FROM tenants t
WHERE t.organizer_code IS NULL OR t.organizer_code = ''
ORDER BY t.created_at DESC;

-- ============================================================================
-- STEP 2: Find which organizer they should belong to (via location rentals)
-- ============================================================================

SELECT 
    'SUGGESTED ASSIGNMENTS' as check_type,
    t.id,
    t.full_name,
    t.organizer_code as current_org_code,
    tl.location_id,
    l.name as location_name,
    l.organizer_id,
    o.organizer_code as suggested_org_code,
    o.name as organizer_name
FROM tenants t
JOIN tenant_locations tl ON tl.tenant_id = t.id
JOIN locations l ON l.id = tl.location_id
JOIN organizers o ON o.id = l.organizer_id
WHERE t.organizer_code IS NULL OR t.organizer_code = ''
ORDER BY t.id;

-- ============================================================================
-- STEP 3: Fix tenants by assigning organizer_code from their location's organizer
-- ============================================================================

-- Update tenants that have location rentals
UPDATE tenants
SET organizer_code = subquery.suggested_org_code
FROM (
    SELECT 
        t.id as tenant_id,
        o.organizer_code as suggested_org_code
    FROM tenants t
    JOIN tenant_locations tl ON tl.tenant_id = t.id
    JOIN locations l ON l.id = tl.location_id
    JOIN organizers o ON o.id = l.organizer_id
    WHERE (t.organizer_code IS NULL OR t.organizer_code = '')
    GROUP BY t.id, o.organizer_code
) AS subquery
WHERE tenants.id = subquery.tenant_id;

-- ============================================================================
-- STEP 4: For tenants without location rentals, check their profile's organizer_code
-- ============================================================================

-- Show tenants still without organizer_code (no location rentals)
SELECT 
    'TENANTS STILL WITHOUT ORG CODE' as check_type,
    t.id,
    t.full_name,
    t.profile_id,
    p.organizer_code as profile_org_code
FROM tenants t
LEFT JOIN profiles p ON p.id = t.profile_id
WHERE (t.organizer_code IS NULL OR t.organizer_code = '');

-- ============================================================================
-- STEP 5: Assign organizer_code from profile if available
-- ============================================================================

UPDATE tenants
SET organizer_code = p.organizer_code
FROM profiles p
WHERE tenants.profile_id = p.id
AND (tenants.organizer_code IS NULL OR tenants.organizer_code = '')
AND p.organizer_code IS NOT NULL AND p.organizer_code != '';

-- ============================================================================
-- STEP 6: Final verification
-- ============================================================================

SELECT 
    'FINAL STATE' as check_type,
    COUNT(*) as tenants_without_org_code
FROM tenants
WHERE organizer_code IS NULL OR organizer_code = '';

-- Show all tenants and their organizer codes
SELECT 
    'ALL TENANTS' as check_type,
    t.id,
    t.full_name,
    t.organizer_code,
    o.name as organizer_name
FROM tenants t
LEFT JOIN organizers o ON o.organizer_code = t.organizer_code
ORDER BY t.organizer_code, t.full_name;
