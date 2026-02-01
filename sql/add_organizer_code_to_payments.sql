-- Add organizer_code to tenant_payments
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS organizer_code text;

-- Optional: Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_payments_organizer_code ON public.tenant_payments(organizer_code);

-- Backfill: Update existing payments with their tenant's organizer_code
UPDATE public.tenant_payments tp
SET organizer_code = t.organizer_code
FROM public.tenants t
WHERE tp.tenant_id = t.id
AND tp.organizer_code IS NULL;
