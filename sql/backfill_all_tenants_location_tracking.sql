-- Backfill location and organizer info for ALL tenants' rent transactions
-- This ensures ALL tenants (including tenant_id 44) have proper tracking

-- 1. First, ensure columns exist
ALTER TABLE public.tenant_transactions 
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES public.locations(id);

ALTER TABLE public.tenant_transactions 
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_location_id ON public.tenant_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_organizer_id ON public.tenant_transactions(organizer_id);

-- 3. Backfill ALL rent transactions with location/organizer info
-- For each tenant_transaction that is a rent payment, find the matching tenant_location

-- First, let's see how many rent transactions need updating
SELECT 
    'Rent transactions without location_id' as status,
    COUNT(*) as count
FROM public.tenant_transactions
WHERE category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND location_id IS NULL;

-- 4. Update ALL rent transactions with their tenant's location info
-- Try to match by tenant_id and set the first active location
UPDATE public.tenant_transactions tt
SET 
    location_id = sub.location_id,
    organizer_id = sub.organizer_id
FROM (
    SELECT DISTINCT ON (tl.tenant_id)
        tl.tenant_id,
        tl.location_id,
        tl.organizer_id
    FROM public.tenant_locations tl
    WHERE tl.is_active = true
    ORDER BY tl.tenant_id, tl.created_at DESC
) sub
WHERE tt.tenant_id = sub.tenant_id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.location_id IS NULL;

-- 5. Also update based on description matching (more accurate)
-- Try to match transaction description with location name
UPDATE public.tenant_transactions tt
SET 
    location_id = tl.location_id,
    organizer_id = tl.organizer_id
FROM public.tenant_locations tl
JOIN public.locations l ON l.id = tl.location_id
WHERE tt.tenant_id = tl.tenant_id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND (
    tt.description ILIKE '%' || l.name || '%'
    OR tt.description ILIKE '%' || l.program_name || '%'
)
AND tt.location_id IS NULL;

-- 6. Verify updates for all tenants
SELECT 
    t.full_name as tenant_name,
    t.id as tenant_id,
    COUNT(tt.id) as rent_transactions,
    COUNT(tt.location_id) as with_location,
    COUNT(tt.organizer_id) as with_organizer
FROM public.tenant_transactions tt
JOIN public.tenants t ON t.id = tt.tenant_id
WHERE tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
GROUP BY t.id, t.full_name
ORDER BY rent_transactions DESC;

-- 7. Show specific data for tenant_id 44
SELECT 
    'Tenant 44 (Hazman)' as tenant,
    COUNT(*) as total_rent_transactions,
    COUNT(location_id) as with_location,
    COUNT(organizer_id) as with_organizer
FROM public.tenant_transactions
WHERE tenant_id = 44
AND category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental');
