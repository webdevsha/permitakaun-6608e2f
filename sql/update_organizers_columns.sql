-- Add columns to organizers table to support Tenant-like settings
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS ic_number text,
ADD COLUMN IF NOT EXISTS ssm_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS profile_image_url text,
ADD COLUMN IF NOT EXISTS ssm_file_url text,
ADD COLUMN IF NOT EXISTS ic_file_url text,
ADD COLUMN IF NOT EXISTS food_handling_cert_url text,
ADD COLUMN IF NOT EXISTS other_docs_url text;
