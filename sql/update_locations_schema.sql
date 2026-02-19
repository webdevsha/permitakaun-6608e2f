-- Add new columns for Lokasi & Permit features
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS map_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Drop existing check constraint if it exists (to allow new types)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'locations_type_check'
    ) THEN
        ALTER TABLE locations DROP CONSTRAINT locations_type_check;
    END IF;
END $$;

-- Add updated check constraint (optional, but good for data integrity)
-- We allow the old types plus the new ones: 'daily', 'monthly', 'expo', 'bazar_ramadhan', 'bazar_raya'
ALTER TABLE locations
ADD CONSTRAINT locations_type_check
CHECK (type IN ('daily', 'monthly', 'expo', 'bazar_ramadhan', 'bazar_raya'));

-- Comment on columns for clarity
COMMENT ON COLUMN locations.map_url IS 'URL to Google Maps or Waze';
COMMENT ON COLUMN locations.description IS 'Detailed description of the location/event';
COMMENT ON COLUMN locations.start_date IS 'Start date for temporary events (Expo/Bazar)';
COMMENT ON COLUMN locations.end_date IS 'End date for temporary events (Expo/Bazar)';
