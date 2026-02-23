-- Fix: Add missing columns to tenant_payments
-- Run this in Supabase SQL Editor to resolve:
--   "Could not find the 'organizer_id' column of 'tenant_payments' in the schema cache"

-- 1. Add organizer_id (FK to organizers)
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL;

-- 2. Add remarks (free-text notes on manual payments)
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_payments_organizer_id ON public.tenant_payments(organizer_id);

-- 4. Backfill organizer_id from location (most reliable source)
UPDATE public.tenant_payments tp
SET organizer_id = l.organizer_id
FROM public.locations l
WHERE tp.location_id = l.id
  AND tp.organizer_id IS NULL
  AND l.organizer_id IS NOT NULL;

-- 5. Backfill from tenant's organizer_code (fallback)
UPDATE public.tenant_payments tp
SET organizer_id = o.id
FROM public.organizers o
JOIN public.tenants t ON t.organizer_code = o.organizer_code
WHERE tp.tenant_id = t.id
  AND tp.organizer_id IS NULL
  AND t.organizer_code IS NOT NULL;

-- 6. Reload schema cache so PostgREST picks up the new columns immediately
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenant_payments'
ORDER BY ordinal_position;
