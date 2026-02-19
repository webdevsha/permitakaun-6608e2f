-- Add columns for Location Module enhancements
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Index for category
CREATE INDEX IF NOT EXISTS idx_locations_category ON public.locations(category);

-- Add comment
COMMENT ON COLUMN public.locations.category IS 'Category of the location (Expo, Bazar Ramadhan, etc)';
