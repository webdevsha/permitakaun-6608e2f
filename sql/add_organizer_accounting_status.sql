-- Add accounting_status column to organizers table
ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS accounting_status TEXT DEFAULT 'inactive';

-- Optional: Default existing active organizers to inactive or active based on preference.
-- Keeping default as inactive for safety, similar to tenants.
