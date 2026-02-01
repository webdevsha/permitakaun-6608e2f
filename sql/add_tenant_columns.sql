-- Add missing columns to tenants table for complete registration data
-- This ensures all signup form fields can be saved to the database

-- Add SSM number column
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS ssm_number TEXT;

-- Add address column
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add organizer code column (for tenants to link to organizers)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS organizer_code TEXT;

-- Add file URL columns for document uploads
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS ssm_file_url TEXT;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS ic_file_url TEXT;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS food_handling_cert_url TEXT;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS other_docs_url TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.tenants.ssm_number IS 'SSM registration number for business';
COMMENT ON COLUMN public.tenants.address IS 'Mailing address for correspondence';
COMMENT ON COLUMN public.tenants.organizer_code IS 'Code linking tenant to their organizer';
