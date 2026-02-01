-- COMPLETE FIX: Link Organizer -> Locations -> Tenants -> Transactions
-- This script ensures all data is properly connected

DO $$
DECLARE
    org_id uuid;
    org_code text;
    org_email text := 'organizer@permit.com';
    ahmad_tenant_id bigint;
    location_count integer;
    tenant_count integer;
BEGIN
    -- Step 1: Get the organizer details
    SELECT id, organizer_code INTO org_id, org_code
    FROM public.organizers
    WHERE email = org_email
    LIMIT 1;
    
    RAISE NOTICE '=== ORGANIZER ===';
    RAISE NOTICE 'ID: %, Code: %', org_id, org_code;
    
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'Organizer not found for email: %', org_email;
    END IF;
    
    -- Step 2: Find Ahmad's tenant record
    SELECT id INTO ahmad_tenant_id
    FROM public.tenants
    WHERE full_name LIKE '%Ahmad%'
    OR email LIKE '%ahmad%'
    LIMIT 1;
    
    RAISE NOTICE '=== AHMAD ===';
    RAISE NOTICE 'Tenant ID: %', ahmad_tenant_id;
    
    -- Step 3: Update Ahmad's tenant record to link to organizer
    IF ahmad_tenant_id IS NOT NULL THEN
        UPDATE public.tenants
        SET 
            organizer_code = org_code,
            organizer_id = org_id
        WHERE id = ahmad_tenant_id;
        
        RAISE NOTICE 'Updated Ahmad tenant record with organizer links';
    END IF;
    
    -- Step 4: Find and link Ahmad's location
    -- Look for locations that Ahmad created or is associated with
    UPDATE public.locations
    SET organizer_id = org_id
    WHERE id IN (
        -- Locations that Ahmad rents
        SELECT DISTINCT tl.location_id
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = ahmad_tenant_id
    )
    OR (
        -- Or locations with no organizer that were created recently
        organizer_id IS NULL 
        AND created_at >= (SELECT created_at - INTERVAL '30 days' FROM organizers WHERE id = org_id)
    );
    
    GET DIAGNOSTICS location_count = ROW_COUNT;
    RAISE NOTICE 'Linked % locations to organizer', location_count;
    
    -- Step 5: Update ALL tenants with ORG001 code to link to this organizer
    UPDATE public.tenants
    SET organizer_id = org_id
    WHERE organizer_code = org_code
    AND (organizer_id IS NULL OR organizer_id != org_id);
    
    GET DIAGNOSTICS tenant_count = ROW_COUNT;
    RAISE NOTICE 'Updated % tenants with organizer_id', tenant_count;
    
    -- Step 6: Verify the connections
    RAISE NOTICE '=== VERIFICATION ===';
    
    -- Count locations
    SELECT COUNT(*) INTO location_count
    FROM public.locations
    WHERE organizer_id = org_id;
    RAISE NOTICE 'Total locations: %', location_count;
    
    -- Count tenants by code
    SELECT COUNT(*) INTO tenant_count
    FROM public.tenants
    WHERE organizer_code = org_code;
    RAISE NOTICE 'Total tenants (by code): %', tenant_count;
    
    -- Count tenants by location rental
    SELECT COUNT(DISTINCT tl.tenant_id) INTO tenant_count
    FROM public.tenant_locations tl
    WHERE tl.location_id IN (
        SELECT id FROM locations WHERE organizer_id = org_id
    );
    RAISE NOTICE 'Total tenants (by rental): %', tenant_count;
    
END $$;

-- Final verification queries
SELECT '=== FINAL STATE ===' as section;

SELECT 'Organizer' as type, id, email, organizer_code
FROM public.organizers
WHERE email = 'organizer@permit.com';

SELECT 'Locations' as type, id, name, organizer_id
FROM public.locations
WHERE organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com');

SELECT 'Tenants' as type, id, full_name, organizer_code, organizer_id
FROM public.tenants
WHERE organizer_code = 'ORG001'
OR organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com');

SELECT 'Tenant-Location Links' as type, tl.id, t.full_name, l.name
FROM public.tenant_locations tl
JOIN public.tenants t ON tl.tenant_id = t.id
JOIN public.locations l ON tl.location_id = l.id
WHERE l.organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com');
