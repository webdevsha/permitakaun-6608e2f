-- Fix organizer_id for tenant_id 44's rent transactions
-- The issue: tenant_locations has organizer_id but tenant_transactions doesn't

-- 1. Check tenant_id 44's locations and their organizers
SELECT 
    tl.id as tenant_location_id,
    tl.tenant_id,
    tl.location_id,
    tl.organizer_id as tl_organizer_id,
    l.name as location_name,
    o.id as organizer_id_from_location,
    o.name as organizer_name
FROM public.tenant_locations tl
LEFT JOIN public.locations l ON l.id = tl.location_id
LEFT JOIN public.organizers o ON o.id = tl.organizer_id OR o.id = l.organizer_id
WHERE tl.tenant_id = 44
AND tl.is_active = true;

-- 2. Update tenant_transactions to get organizer_id from locations table
UPDATE public.tenant_transactions tt
SET organizer_id = l.organizer_id
FROM public.locations l
WHERE tt.location_id = l.id
AND tt.tenant_id = 44
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.organizer_id IS NULL;

-- 3. Alternative: Get organizer_id from tenant_locations
UPDATE public.tenant_transactions tt
SET organizer_id = tl.organizer_id
FROM public.tenant_locations tl
WHERE tt.tenant_id = tl.tenant_id
AND tt.location_id = tl.location_id
AND tt.tenant_id = 44
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.organizer_id IS NULL;

-- 4. If still NULL, try matching by location name in description
UPDATE public.tenant_transactions tt
SET 
    location_id = l.id,
    organizer_id = l.organizer_id
FROM public.locations l
JOIN public.tenant_locations tl ON tl.location_id = l.id
WHERE tt.tenant_id = tl.tenant_id
AND tt.tenant_id = 44
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND (
    tt.description ILIKE '%' || l.name || '%'
    OR tt.description ILIKE '%' || COALESCE(l.program_name, '') || '%'
)
AND tt.location_id IS NULL;

-- 5. Verify fix for tenant_id 44
SELECT 
    'Tenant 44 (Hazman)' as tenant,
    COUNT(*) as total_rent_transactions,
    COUNT(location_id) as with_location,
    COUNT(organizer_id) as with_organizer
FROM public.tenant_transactions
WHERE tenant_id = 44
AND category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental');

-- 6. Show the actual transaction details
SELECT 
    id,
    description,
    amount,
    location_id,
    organizer_id,
    date
FROM public.tenant_transactions
WHERE tenant_id = 44
AND category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
ORDER BY date DESC;
