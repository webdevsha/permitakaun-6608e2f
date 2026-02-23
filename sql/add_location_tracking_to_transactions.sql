-- Add location and organizer tracking to tenant_transactions
-- This helps track which Lokasi and Organizer each transaction belongs to

-- 1. Check current columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Add location_id column if not exists
ALTER TABLE public.tenant_transactions 
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES public.locations(id);

-- 3. Add organizer_id column if not exists
ALTER TABLE public.tenant_transactions 
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_location_id ON public.tenant_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_organizer_id ON public.tenant_transactions(organizer_id);

-- 5. Backfill existing rent transactions with location/organizer info
-- Try to match based on tenant's active locations
UPDATE public.tenant_transactions tt
SET 
    location_id = tl.location_id,
    organizer_id = tl.organizer_id
FROM public.tenant_locations tl
WHERE tt.tenant_id = tl.tenant_id
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND tt.location_id IS NULL
AND tl.is_active = true;

-- 6. Add comment for documentation
COMMENT ON COLUMN public.tenant_transactions.location_id IS 'The location (Lokasi) this transaction is for - tracks which site/stall the rent payment relates to';
COMMENT ON COLUMN public.tenant_transactions.organizer_id IS 'The organizer managing this location - tracks who receives the payment';

-- 7. Verify the changes
SELECT 
    'tenant_transactions with location_id' as description,
    COUNT(*) as count
FROM public.tenant_transactions 
WHERE location_id IS NOT NULL
UNION ALL
SELECT 
    'tenant_transactions with organizer_id',
    COUNT(*)
FROM public.tenant_transactions 
WHERE organizer_id IS NOT NULL;
