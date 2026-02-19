ALTER TABLE locations ADD COLUMN IF NOT EXISTS rate_foodtruck numeric DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS estimate_monthly_khemah numeric DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS estimate_monthly_cbs numeric DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS estimate_monthly_foodtruck numeric DEFAULT 0;
