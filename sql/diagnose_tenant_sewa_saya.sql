-- ============================================================================
-- DIAGNOSE: Tenant Sewa Saya Empty Issue
-- ============================================================================

-- 1. Find Shafira's tenant record
SELECT 
    'TENANT PROFILE' as check_type,
    p.id as profile_id,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code as profile_org_code
FROM public.profiles p
WHERE p.email LIKE '%shafira%' OR p.full_name ILIKE '%shafira%';

-- 2. Get tenant ID and details
SELECT 
    'TENANT RECORD' as check_type,
    t.id as tenant_id,
    t.profile_id,
    t.email,
    t.full_name,
    t.organizer_code,
    t.status
FROM public.tenants t
WHERE t.email LIKE '%shafira%' OR t.full_name ILIKE '%shafira%';

-- 3. Check tenant_organizers links
SELECT 
    'TENANT-ORGANIZER LINKS' as check_type,
    tor.id as link_id,
    tor.tenant_id,
    tor.organizer_id,
    tor.status as link_status,
    o.name as organizer_name,
    o.organizer_code,
    tor.requested_at,
    tor.approved_at
FROM public.tenant_organizers tor
JOIN public.tenants t ON t.id = tor.tenant_id
JOIN public.organizers o ON o.id = tor.organizer_id
WHERE t.email LIKE '%shafira%' OR t.full_name ILIKE '%shafira%';

-- 4. Check tenant_locations (Sewa Saya)
SELECT 
    'TENANT LOCATIONS (SEWA SAYA)' as check_type,
    tl.id,
    tl.tenant_id,
    tl.location_id,
    tl.organizer_id,
    tl.status,
    tl.is_active,
    l.name as location_name,
    o.name as organizer_name,
    o.organizer_code
FROM public.tenant_locations tl
JOIN public.tenants t ON t.id = tl.tenant_id
LEFT JOIN public.locations l ON l.id = tl.location_id
LEFT JOIN public.organizers o ON o.id = tl.organizer_id
WHERE t.email LIKE '%shafira%' OR t.full_name ILIKE '%shafira%';

-- 5. Check all active tenant_locations for this tenant
SELECT 
    'ACTIVE TENANT LOCATIONS' as check_type,
    COUNT(*) as count
FROM public.tenant_locations tl
JOIN public.tenants t ON t.id = tl.tenant_id
WHERE (t.email LIKE '%shafira%' OR t.full_name ILIKE '%shafira%')
AND tl.is_active = true;

-- 6. Check RLS policies on tenant_locations
SELECT 
    'RLS POLICIES' as check_type,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'tenant_locations';

-- 7. Check if RLS is enabled
SELECT 
    'RLS STATUS' as check_type,
    relname,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'tenant_locations';

-- 8. Get available locations for linked organizers
SELECT 
    'AVAILABLE LOCATIONS' as check_type,
    l.id as location_id,
    l.name as location_name,
    o.name as organizer_name,
    o.organizer_code,
    l.status as location_status
FROM public.locations l
JOIN public.organizers o ON o.id = l.organizer_id
WHERE o.id IN (
    SELECT tor.organizer_id 
    FROM public.tenant_organizers tor
    JOIN public.tenants t ON t.id = tor.tenant_id
    WHERE (t.email LIKE '%shafira%' OR t.full_name ILIKE '%shafira%')
    AND tor.status IN ('active', 'approved')
)
AND l.status = 'active';

-- 9. Fix: Insert sample tenant_locations if missing
DO $$
DECLARE
    v_tenant_id INTEGER;
    v_organizer_id UUID;
    v_location_id INTEGER;
BEGIN
    -- Get Shafira's tenant ID
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE p.email LIKE '%shafira%' OR p.full_name ILIKE '%shafira%'
    LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Tenant Shafira not found!';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found tenant_id: %', v_tenant_id;
    
    -- Check if tenant has any active locations
    IF EXISTS(SELECT 1 FROM public.tenant_locations WHERE tenant_id = v_tenant_id AND is_active = true) THEN
        RAISE NOTICE 'Tenant already has active locations';
    ELSE
        RAISE NOTICE 'No active locations found for tenant. Checking for approved organizer links...';
        
        -- Find approved organizer link
        SELECT tor.organizer_id INTO v_organizer_id
        FROM public.tenant_organizers tor
        WHERE tor.tenant_id = v_tenant_id
        AND tor.status IN ('active', 'approved')
        LIMIT 1;
        
        IF v_organizer_id IS NULL THEN
            RAISE NOTICE 'No approved organizer link found!';
            RETURN;
        END IF;
        
        RAISE NOTICE 'Found organizer_id: %', v_organizer_id;
        
        -- Find an active location for this organizer
        SELECT id INTO v_location_id
        FROM public.locations
        WHERE organizer_id = v_organizer_id
        AND status = 'active'
        LIMIT 1;
        
        IF v_location_id IS NULL THEN
            RAISE NOTICE 'No active locations found for organizer!';
            RETURN;
        END IF;
        
        RAISE NOTICE 'Found location_id: %', v_location_id;
        
        -- Insert tenant_location
        INSERT INTO public.tenant_locations (
            tenant_id,
            location_id,
            organizer_id,
            status,
            is_active,
            rate_type,
            created_at
        ) VALUES (
            v_tenant_id,
            v_location_id,
            v_organizer_id,
            'approved',
            true,
            'monthly',
            NOW()
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Created tenant_location record';
    END IF;
END $$;
