-- ============================================================================
-- DIAGNOSE: /bayar Page Empty Issue
-- ============================================================================

-- 1. Check active organizers (excluding ORG001)
SELECT 
    'ACTIVE ORGANIZERS' as check_type,
    COUNT(*) as count,
    STRING_AGG(name || ' (' || organizer_code || ')', ', ') as organizers
FROM public.organizers
WHERE status = 'active'
AND organizer_code != 'ORG001';

-- 2. Check active locations with their organizers
SELECT 
    'ACTIVE LOCATIONS' as check_type,
    l.id,
    l.name as location_name,
    l.status,
    o.name as organizer_name,
    o.organizer_code
FROM public.locations l
JOIN public.organizers o ON o.id = l.organizer_id
WHERE l.status = 'active'
AND o.organizer_code != 'ORG001'
ORDER BY o.name, l.name;

-- 3. Count locations per organizer
SELECT 
    o.name as organizer_name,
    o.organizer_code,
    COUNT(l.id) as location_count
FROM public.organizers o
LEFT JOIN public.locations l ON l.organizer_id = o.id AND l.status = 'active'
WHERE o.status = 'active'
AND o.organizer_code != 'ORG001'
GROUP BY o.id, o.name, o.organizer_code
ORDER BY location_count DESC;

-- 4. Check if any locations have NULL organizer_id
SELECT 
    'LOCATIONS WITH NULL ORGANIZER' as check_type,
    COUNT(*) as count
FROM public.locations
WHERE organizer_id IS NULL;

-- 5. Check locations table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'locations'
ORDER BY ordinal_position;

-- 6. Fix: Ensure all locations have valid organizer_id
UPDATE public.locations
SET organizer_id = (SELECT id FROM public.organizers WHERE organizer_code = 'ORG002' LIMIT 1)
WHERE organizer_id IS NULL;

-- 7. Create sample locations if missing for Shafira Orgs
DO $$
DECLARE
    shafira_org_id UUID;
BEGIN
    SELECT id INTO shafira_org_id
    FROM public.organizers
    WHERE organizer_code = 'ORG1001';
    
    IF shafira_org_id IS NULL THEN
        RAISE NOTICE 'Shafira Orgs (ORG1001) not found!';
        RETURN;
    END IF;
    
    -- Check if Shafira has any locations
    IF EXISTS(SELECT 1 FROM public.locations WHERE organizer_id = shafira_org_id) THEN
        RAISE NOTICE 'Shafira Orgs already has locations';
    ELSE
        RAISE NOTICE 'Creating sample locations for Shafira Orgs...';
        
        INSERT INTO public.locations (
            name,
            program_name,
            type,
            operating_days,
            days_per_week,
            total_lots,
            rate_khemah,
            rate_cbs,
            rate_monthly,
            rate_monthly_khemah,
            rate_monthly_cbs,
            status,
            organizer_id,
            created_at
        ) VALUES 
        (
            'Pasar Malam Jalan Sayang',
            'Pasar Malam Komuniti',
            'daily',
            'Sabtu & Ahad',
            2,
            50,
            35.00,
            25.00,
            0,
            0,
            0,
            'active',
            shafira_org_id,
            NOW()
        ),
        (
            'Pasar Tani Jalan Kebun',
            'Pasar Tani Pagi',
            'daily',
            'Ahad',
            1,
            30,
            0,
            0,
            200.00,
            150.00,
            100.00,
            'active',
            shafira_org_id,
            NOW()
        );
        
        RAISE NOTICE 'Created 2 sample locations for Shafira Orgs';
    END IF;
END $$;

-- 8. Create sample locations for Kumim if missing
DO $$
DECLARE
    kumim_org_id UUID;
BEGIN
    SELECT id INTO kumim_org_id
    FROM public.organizers
    WHERE organizer_code = 'ORG002';
    
    IF kumim_org_id IS NULL THEN
        RAISE NOTICE 'Kumim (ORG002) not found!';
        RETURN;
    END IF;
    
    IF EXISTS(SELECT 1 FROM public.locations WHERE organizer_id = kumim_org_id) THEN
        RAISE NOTICE 'Kumim already has locations';
    ELSE
        RAISE NOTICE 'Creating sample locations for Kumim...';
        
        INSERT INTO public.locations (
            name,
            program_name,
            type,
            operating_days,
            days_per_week,
            total_lots,
            rate_khemah,
            rate_cbs,
            rate_monthly,
            rate_monthly_khemah,
            rate_monthly_cbs,
            status,
            organizer_id,
            created_at
        ) VALUES 
        (
            'Lot Pakir Hadapan MPKL Banting',
            'Pasar Malam MPKL',
            'daily',
            'Sabtu & Ahad',
            2,
            100,
            40.00,
            30.00,
            0,
            0,
            0,
            'active',
            kumim_org_id,
            NOW()
        ),
        (
            'Kompleks Sukan Pandamaran',
            'Pasar Malam Sukan',
            'monthly',
            'Isnin - Ahad',
            7,
            40,
            0,
            0,
            350.00,
            200.00,
            150.00,
            'active',
            kumim_org_id,
            NOW()
        );
        
        RAISE NOTICE 'Created 2 sample locations for Kumim';
    END IF;
END $$;

-- 9. Final verification
SELECT 
    'FINAL LOCATION COUNT' as check_type,
    COUNT(*) as total_locations,
    COUNT(DISTINCT organizer_id) as organizers_with_locations
FROM public.locations
WHERE status = 'active';
