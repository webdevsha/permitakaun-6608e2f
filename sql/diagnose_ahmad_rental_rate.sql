-- Diagnostic: Check Ahmad's rental data and rates

-- 1. Find Ahmad's tenant record
SELECT 
    'Ahmad Tenant Record' as info,
    id,
    full_name,
    email,
    organizer_code
FROM public.tenants
WHERE full_name LIKE '%Ahmad%' OR email LIKE '%ahmad%';

-- 2. Check Ahmad's tenant_locations (rental records)
SELECT 
    'Ahmad Rental Records' as info,
    tl.id,
    tl.tenant_id,
    tl.location_id,
    tl.rate_type,
    tl.status,
    tl.stall_number,
    l.name as location_name,
    l.rate_monthly,
    l.rate_khemah,
    l.rate_cbs,
    l.organizer_id
FROM public.tenant_locations tl
JOIN public.locations l ON tl.location_id = l.id
WHERE tl.tenant_id IN (
    SELECT id FROM tenants WHERE full_name LIKE '%Ahmad%' OR email LIKE '%ahmad%'
);

-- 3. Check the location details
SELECT 
    'Location Details' as info,
    l.*
FROM public.locations l
WHERE l.id IN (
    SELECT location_id FROM tenant_locations 
    WHERE tenant_id IN (
        SELECT id FROM tenants WHERE full_name LIKE '%Ahmad%' OR email LIKE '%ahmad%'
    )
);

-- 4. Calculate what display_price SHOULD be
SELECT 
    'Calculated Display Price' as info,
    tl.rate_type,
    CASE 
        WHEN tl.rate_type = 'khemah' AND l.rate_khemah IS NOT NULL AND l.rate_khemah > 0 THEN l.rate_khemah
        WHEN tl.rate_type = 'cbs' AND l.rate_cbs IS NOT NULL AND l.rate_cbs > 0 THEN l.rate_cbs
        WHEN tl.rate_type = 'monthly' AND l.rate_monthly IS NOT NULL AND l.rate_monthly > 0 THEN l.rate_monthly
        ELSE COALESCE(l.rate_monthly, l.rate_khemah, l.rate_cbs, 0)
    END as calculated_price,
    l.rate_monthly,
    l.rate_khemah,
    l.rate_cbs
FROM public.tenant_locations tl
JOIN public.locations l ON tl.location_id = l.id
WHERE tl.tenant_id IN (
    SELECT id FROM tenants WHERE full_name LIKE '%Ahmad%' OR email LIKE '%ahmad%'
);
