-- Investigate duplicate organizer records
SELECT 
    id,
    email,
    organizer_code,
    created_at
FROM public.organizers
WHERE email = 'organizer@permit.com'
ORDER BY created_at;

-- Check what's referencing these organizer codes
SELECT 'tenants' as table_name, COUNT(*) as count, organizer_code
FROM public.tenants
WHERE organizer_code LIKE 'ORG001%'
GROUP BY organizer_code

UNION ALL

SELECT 'tenant_payments' as table_name, COUNT(*) as count, organizer_code
FROM public.tenant_payments
WHERE organizer_code LIKE 'ORG001%'
GROUP BY organizer_code

UNION ALL

SELECT 'locations' as table_name, COUNT(*) as count, 
       (SELECT organizer_code FROM organizers WHERE id = locations.organizer_id) as organizer_code
FROM public.locations
WHERE organizer_id IN (SELECT id FROM organizers WHERE organizer_code LIKE 'ORG001%')
GROUP BY organizer_code;

-- Consolidation Plan:
-- 1. Keep the OLDEST organizer record (by created_at)
-- 2. Update all locations to point to the primary organizer ID
-- 3. Delete duplicate organizer records
-- 4. Ensure all codes are 'ORG001'

DO $$
DECLARE
    primary_organizer_id uuid;
    duplicate_organizer_ids uuid[];
BEGIN
    -- Find the primary (oldest) organizer record
    SELECT id INTO primary_organizer_id
    FROM public.organizers
    WHERE email = 'organizer@permit.com'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Find duplicate organizer IDs
    SELECT array_agg(id) INTO duplicate_organizer_ids
    FROM public.organizers
    WHERE email = 'organizer@permit.com'
    AND id != primary_organizer_id;

    RAISE NOTICE 'Primary Organizer ID: %', primary_organizer_id;
    RAISE NOTICE 'Duplicate IDs to merge: %', duplicate_organizer_ids;

    -- Update locations to point to primary organizer
    IF duplicate_organizer_ids IS NOT NULL THEN
        UPDATE public.locations
        SET organizer_id = primary_organizer_id
        WHERE organizer_id = ANY(duplicate_organizer_ids);
        
        RAISE NOTICE 'Updated locations to primary organizer';
    END IF;

    -- Delete duplicate organizer records FIRST (before updating code)
    IF duplicate_organizer_ids IS NOT NULL THEN
        DELETE FROM public.organizers
        WHERE id = ANY(duplicate_organizer_ids);
        
        RAISE NOTICE 'Deleted % duplicate organizer records', array_length(duplicate_organizer_ids, 1);
    END IF;

    -- NOW update the primary organizer code (no conflict since duplicates are gone)
    UPDATE public.organizers
    SET organizer_code = 'ORG001'
    WHERE id = primary_organizer_id;
    
    RAISE NOTICE 'Updated primary organizer code to ORG001';

    -- Final verification
    RAISE NOTICE 'Consolidation complete. Remaining organizer records:';
END $$;

-- Verify the result
SELECT 
    id,
    email,
    organizer_code,
    created_at
FROM public.organizers
WHERE email = 'organizer@permit.com';
