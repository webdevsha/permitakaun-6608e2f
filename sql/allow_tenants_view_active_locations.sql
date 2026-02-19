
-- Allow authenticated users (including tenants) to view active locations
-- This enables the "Available Locations" feature for tenants

DROP POLICY IF EXISTS "Public/Authenticated users can view active locations" ON locations;

CREATE POLICY "Public/Authenticated users can view active locations"
ON locations FOR SELECT
TO authenticated
USING (status = 'active');

-- Ensure RLS is enabled
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated role
GRANT SELECT ON locations TO authenticated;
