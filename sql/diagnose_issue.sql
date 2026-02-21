-- ============================================================================
-- DIAGNOSE: Check current RLS policies and tenant data visibility
-- ============================================================================

-- 1. Check RLS policies on tenant_locations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual -- This shows the USING expression
FROM pg_policies 
WHERE tablename = 'tenant_locations'
ORDER BY policyname;

-- 2. Check if RLS is enabled
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as force_rls
FROM pg_class 
WHERE relname IN ('tenant_locations', 'tenants', 'locations')
AND relnamespace = 'public'::regnamespace;

-- 3. Check for any tenants that should be visible
SELECT 
    t.id,
    t.full_name,
    t.status,
    t.organizer_code,
    tl.id as tenant_location_id,
    tl.status as location_status,
    tl.organizer_id as location_organizer_id,
    l.name as location_name,
    l.organizer_id as location_owner_id
FROM tenants t
LEFT JOIN tenant_locations tl ON tl.tenant_id = t.id
LEFT JOIN locations l ON l.id = tl.location_id
WHERE t.status = 'active'
LIMIT 10;

-- 4. Check tenant_organizers links
SELECT 
    to2.id,
    to2.tenant_id,
    to2.organizer_id,
    to2.status,
    t.full_name,
    o.name as organizer_name
FROM tenant_organizers to2
JOIN tenants t ON t.id = to2.tenant_id
JOIN organizers o ON o.id = to2.organizer_id
LIMIT 10;

-- 5. Count active tenants
SELECT 
    'Total active tenants' as metric,
    COUNT(*) as count
FROM tenants 
WHERE status = 'active'
UNION ALL
SELECT 
    'Total tenant_locations' as metric,
    COUNT(*) as count
FROM tenant_locations
UNION ALL
SELECT 
    'Total tenant_organizers links' as metric,
    COUNT(*) as count
FROM tenant_organizers;
