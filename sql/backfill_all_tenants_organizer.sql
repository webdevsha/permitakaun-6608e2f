-- Backfill organizer_id for ALL tenants' rent transactions
-- This ensures ALL tenants (including tenant_id 44) have proper organizer tracking

-- Step 1: Get organizer_id from locations table via location_id
UPDATE public.tenant_transactions tt
SET organizer_id = l.organizer_id
FROM public.locations l
WHERE tt.location_id = l.id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.organizer_id IS NULL;

-- Step 2: For transactions without location_id, try to match by tenant's locations
-- Get organizer from tenant_locations
UPDATE public.tenant_transactions tt
SET 
    location_id = tl.location_id,
    organizer_id = COALESCE(tt.organizer_id, tl.organizer_id, l.organizer_id)
FROM public.tenant_locations tl
JOIN public.locations l ON l.id = tl.location_id
WHERE tt.tenant_id = tl.tenant_id
AND tt.tenant_id IN (
    -- Only update for tenants with active locations
    SELECT DISTINCT tenant_id FROM public.tenant_locations WHERE is_active = true
)
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.location_id IS NULL;

-- Step 3: Match by description containing location name
UPDATE public.tenant_transactions tt
SET 
    location_id = l.id,
    organizer_id = l.organizer_id
FROM public.locations l
JOIN public.tenant_locations tl ON tl.location_id = l.id
WHERE tt.tenant_id = tl.tenant_id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.location_id IS NULL
AND tt.description IS NOT NULL
AND (
    tt.description ILIKE '%' || l.name || '%'
    OR tt.description ILIKE '%' || COALESCE(l.program_name, '') || '%'
);

-- Step 4: Set default location/organizer for remaining unmatched transactions
-- Use the tenant's first active location
UPDATE public.tenant_transactions tt
SET 
    location_id = sub.location_id,
    organizer_id = sub.organizer_id
FROM (
    SELECT DISTINCT ON (tl.tenant_id)
        tl.tenant_id,
        tl.location_id,
        COALESCE(tl.organizer_id, l.organizer_id) as organizer_id
    FROM public.tenant_locations tl
    JOIN public.locations l ON l.id = tl.location_id
    WHERE tl.is_active = true
    ORDER BY tl.tenant_id, tl.created_at DESC
) sub
WHERE tt.tenant_id = sub.tenant_id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.location_id IS NULL;

-- Step 5: Verify results for ALL tenants
SELECT 
    t.id as tenant_id,
    t.full_name,
    COUNT(tt.id) as rent_transactions,
    COUNT(tt.location_id) as with_location,
    COUNT(tt.organizer_id) as with_organizer
FROM public.tenant_transactions tt
JOIN public.tenants t ON t.id = tt.tenant_id
WHERE tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
GROUP BY t.id, t.full_name
ORDER BY rent_transactions DESC
LIMIT 30;

-- Step 6: Show details for tenant_id 44
SELECT 
    tt.id,
    tt.description,
    tt.amount,
    tt.location_id,
    tt.organizer_id,
    l.name as location_name,
    o.name as organizer_name,
    tt.date
FROM public.tenant_transactions tt
LEFT JOIN public.locations l ON l.id = tt.location_id
LEFT JOIN public.organizers o ON o.id = tt.organizer_id
WHERE tt.tenant_id = 44
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
ORDER BY tt.date DESC;
