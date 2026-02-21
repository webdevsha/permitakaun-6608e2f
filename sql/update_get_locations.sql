-- Update get_available_locations_for_tenant to include program_name
-- First drop the existing function to allow return type change
DROP FUNCTION IF EXISTS get_available_locations_for_tenant(BIGINT);

-- Recreate with new return type
CREATE FUNCTION get_available_locations_for_tenant(p_tenant_id BIGINT)
RETURNS TABLE (
  location_id INTEGER,
  location_name TEXT,
  program_name TEXT,
  address TEXT,
  google_maps_url TEXT,
  organizer_id UUID,
  organizer_name TEXT,
  rate_khemah NUMERIC,
  rate_cbs NUMERIC,
  rate_monthly NUMERIC,
  rate_monthly_khemah NUMERIC,
  rate_monthly_cbs NUMERIC,
  operating_days TEXT,
  type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify tenant belongs to current user
  IF NOT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = p_tenant_id AND profile_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    l.id as location_id,
    l.name as location_name,
    l.program_name,
    l.address,
    l.google_maps_url,
    l.organizer_id,
    o.name as organizer_name,
    l.rate_khemah,
    l.rate_cbs,
    l.rate_monthly,
    l.rate_monthly_khemah,
    l.rate_monthly_cbs,
    l.operating_days,
    l.type
  FROM locations l
  JOIN organizers o ON l.organizer_id = o.id
  JOIN tenant_organizers tor ON tor.organizer_id = o.id
  WHERE tor.tenant_id = p_tenant_id
  AND tor.status IN ('approved', 'active')
  AND l.status = 'active'
  AND NOT EXISTS (
    -- Exclude locations already assigned to this tenant
    SELECT 1 FROM tenant_locations tl
    WHERE tl.tenant_id = p_tenant_id
    AND tl.location_id = l.id
    AND tl.is_active = TRUE
  )
  ORDER BY l.program_name, o.name, l.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_locations_for_tenant(BIGINT) TO authenticated;

COMMENT ON FUNCTION get_available_locations_for_tenant(BIGINT) IS 
'Returns available locations for a tenant with program_name included';
