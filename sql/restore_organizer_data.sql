-- Diagnostic: Check organizer data after consolidation
-- This script identifies and fixes orphaned data

-- 1. Check current organizer status
SELECT 
    'Current Organizer' as status,
    id,
    email,
    organizer_code,
    created_at
FROM public.organizers
WHERE email = 'organizer@permit.com';

-- 2. Check locations for this organizer
SELECT 
    'Locations' as type,
    COUNT(*) as count,
    organizer_id
FROM public.locations
WHERE organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com')
GROUP BY organizer_id;

-- 3. Check for orphaned locations (organizer_id is NULL or points to deleted organizer)
SELECT 
    'Orphaned Locations' as type,
    id,
    name,
    organizer_id,
    created_at
FROM public.locations
WHERE organizer_id IS NULL 
   OR organizer_id NOT IN (SELECT id FROM organizers)
ORDER BY created_at DESC;

-- 4. Check tenants linked to this organizer
SELECT 
    'Tenants by Code' as type,
    COUNT(*) as count,
    organizer_code
FROM public.tenants
WHERE organizer_code = 'ORG001'
GROUP BY organizer_code;

-- 5. Check tenant_locations for organizer's locations
SELECT 
    'Tenant-Location Links' as type,
    COUNT(*) as count
FROM public.tenant_locations tl
WHERE tl.location_id IN (
    SELECT id FROM locations 
    WHERE organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com')
);

-- ============================================
-- FIX: Restore orphaned data
-- ============================================

DO $$
DECLARE
    primary_organizer_id uuid;
    orphaned_count integer;
BEGIN
    -- Get the primary organizer ID
    SELECT id INTO primary_organizer_id
    FROM public.organizers
    WHERE email = 'organizer@permit.com'
    LIMIT 1;

    RAISE NOTICE 'Primary Organizer ID: %', primary_organizer_id;

    -- Fix 1: Restore locations that might have been created by this organizer
    -- Look for locations with NULL organizer_id or deleted organizer_id
    -- that were created around the same time as the organizer
    UPDATE public.locations
    SET organizer_id = primary_organizer_id
    WHERE (organizer_id IS NULL OR organizer_id NOT IN (SELECT id FROM organizers))
    AND created_at >= (
        SELECT created_at - INTERVAL '1 day' 
        FROM organizers 
        WHERE id = primary_organizer_id
    );
    
    GET DIAGNOSTICS orphaned_count = ROW_COUNT;
    RAISE NOTICE 'Restored % orphaned locations', orphaned_count;

    -- Fix 2: Ensure all tenants with ORG001 code are properly linked
    UPDATE public.tenants
    SET organizer_id = primary_organizer_id
    WHERE organizer_code = 'ORG001'
    AND (organizer_id IS NULL OR organizer_id != primary_organizer_id);
    
    GET DIAGNOSTICS orphaned_count = ROW_COUNT;
    RAISE NOTICE 'Updated % tenant organizer_id links', orphaned_count;

    RAISE NOTICE 'Data restoration complete';
END $$;

-- Verify the fix
SELECT 
    'AFTER FIX: Locations' as status,
    COUNT(*) as count
FROM public.locations
WHERE organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com');

SELECT 
    'AFTER FIX: Tenants' as status,
    COUNT(*) as count
FROM public.tenants
WHERE organizer_code = 'ORG001';

SELECT 
    'AFTER FIX: Tenant-Location Links' as status,
    COUNT(*) as count
FROM public.tenant_locations tl
WHERE tl.location_id IN (
    SELECT id FROM locations 
    WHERE organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com')
);
