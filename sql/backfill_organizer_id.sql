-- ============================================================================
-- BACKFILL: Set organizer_id on tenant_locations from the location's organizer
-- ============================================================================

-- First, check how many records are missing organizer_id
SELECT 
    'Records missing organizer_id' as check_type,
    COUNT(*) as count
FROM tenant_locations
WHERE organizer_id IS NULL
UNION ALL
SELECT 
    'Total records' as check_type,
    COUNT(*) as count
FROM tenant_locations;

-- Backfill organizer_id from the location's organizer
UPDATE tenant_locations tl
SET organizer_id = l.organizer_id
FROM locations l
WHERE tl.location_id = l.id
AND tl.organizer_id IS NULL;

-- Verify
SELECT 
    'Records still missing organizer_id' as check_type,
    COUNT(*) as count
FROM tenant_locations
WHERE organizer_id IS NULL;

SELECT 'Backfill complete' as status;
