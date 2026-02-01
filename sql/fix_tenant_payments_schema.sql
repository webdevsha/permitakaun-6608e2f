-- Comprehensive Fix for tenant_payments Schema
-- Ensures all required columns exist

-- 1. Add payment_method
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'manual';

-- 2. Add billplz_id
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS billplz_id text;

-- 3. Add receipt_url (just in case)
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS receipt_url text;

-- 4. Add organizer_code (just in case)
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS organizer_code text;

-- 5. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_payments_billplz_id ON public.tenant_payments(billplz_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_organizer_code ON public.tenant_payments(organizer_code);
