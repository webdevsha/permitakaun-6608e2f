-- Verify tenant_payments has the required columns for location and organizer

-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If location_id or organizer_id is missing, add them:
/*
-- Add location_id if not exists
ALTER TABLE public.tenant_payments 
ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES public.locations(id);

-- Add organizer_id if not exists  
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES public.organizers(id);

-- Add organizer_code if not exists
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS organizer_code TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_payments_location_id ON public.tenant_payments(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_organizer_id ON public.tenant_payments(organizer_id);
*/
