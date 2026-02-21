-- ============================================================================
-- CHECK & FIX: Data integrity issues
-- ============================================================================

-- 1. Check total tenant_locations count
SELECT 'Total tenant_locations' as metric, COUNT(*) as count FROM tenant_locations
UNION ALL
SELECT 'With organizer_id', COUNT(*) FROM tenant_locations WHERE organizer_id IS NOT NULL
UNION ALL
SELECT 'Without organizer_id', COUNT(*) FROM tenant_locations WHERE organizer_id IS NULL;

-- 2. Check tenant_organizers links
SELECT 'Total tenant_organizers' as metric, COUNT(*) as count FROM tenant_organizers
UNION ALL
SELECT 'Active links', COUNT(*) FROM tenant_organizers WHERE status = 'active'
UNION ALL
SELECT 'Pending links', COUNT(*) FROM tenant_organizers WHERE status = 'pending';

-- 3. Check organizers
SELECT 'Total organizers' as metric, COUNT(*) as count FROM organizers;

-- 4. Check tenants
SELECT 'Total tenants' as metric, COUNT(*) as count FROM tenants
UNION ALL
SELECT 'Active tenants', COUNT(*) FROM tenants WHERE status = 'active'
UNION ALL
SELECT 'Pending tenants', COUNT(*) FROM tenants WHERE status = 'pending';

-- 5. Backfill organizer_id from locations for any missing records
UPDATE tenant_locations tl
SET organizer_id = l.organizer_id
FROM locations l
WHERE tl.location_id = l.id
AND tl.organizer_id IS NULL;

-- 6. Verify backfill worked
SELECT 'After backfill - with organizer_id' as metric, COUNT(*) as count FROM tenant_locations WHERE organizer_id IS NOT NULL
UNION ALL
SELECT 'After backfill - without organizer_id', COUNT(*) FROM tenant_locations WHERE organizer_id IS NULL;

-- 7. Show sample of tenant_locations with their organizer info
SELECT 
    tl.id,
    tl.tenant_id,
    tl.location_id,
    tl.organizer_id,
    tl.status,
    t.full_name as tenant_name,
    l.name as location_name
FROM tenant_locations tl
JOIN tenants t ON t.id = tl.tenant_id
JOIN locations l ON l.id = tl.location_id
LIMIT 10;

-- 8. Show tenant_organizers links
SELECT 
    to2.id,
    to2.tenant_id,
    to2.organizer_id,
    to2.status,
    t.full_name as tenant_name,
    o.name as organizer_name
FROM tenant_organizers to2
JOIN tenants t ON t.id = to2.tenant_id
JOIN organizers o ON o.id = to2.organizer_id
LIMIT 10;
