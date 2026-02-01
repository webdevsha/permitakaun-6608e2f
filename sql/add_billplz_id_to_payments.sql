-- Add billplz_id to tenant_payments
-- Fixes "column 'billplz_id' does not exist" error

ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS billplz_id text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tenant_payments_billplz_id ON public.tenant_payments(billplz_id);
