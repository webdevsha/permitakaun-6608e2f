-- Add organizer_code column to profiles table
-- This allows staff members to be linked to an organizer
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organizer_code TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_organizer_code ON public.profiles(organizer_code);

-- Add comment
COMMENT ON COLUMN public.profiles.organizer_code IS 'Links staff members to an organizer. Staff with this field set will see the same data as their linked organizer.';
