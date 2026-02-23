-- Fix add_tenant_locations: allow re-adding a location that was previously deactivated
-- Bug: the old function skipped any location with an existing tenant_locations record,
-- even if is_active = FALSE. But get_available_locations_for_tenant shows inactive
-- locations as available again, causing "0 lokasi ditambah, 1 dilangkau" on re-add.
-- Fix: if record exists but is_active = FALSE, reactivate it (set is_active=TRUE, status='pending').
--      Only skip if already active.

CREATE OR REPLACE FUNCTION add_tenant_locations(
  p_tenant_id BIGINT,
  p_location_ids INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_location_id INTEGER;
  v_organizer_id UUID;
  v_inserted_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  -- Verify tenant belongs to current user
  IF NOT EXISTS (
    SELECT 1 FROM tenants
    WHERE id = p_tenant_id AND profile_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized'
    );
  END IF;

  -- Check if tenant has at least one approved organizer
  IF NOT EXISTS (
    SELECT 1 FROM tenant_organizers
    WHERE tenant_id = p_tenant_id
    AND status IN ('approved', 'active')
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Anda perlu diluluskan oleh sekurang-kurangnya satu penganjur terlebih dahulu'
    );
  END IF;

  FOREACH v_location_id IN ARRAY p_location_ids
  LOOP
    -- Get organizer_id for this location
    SELECT l.organizer_id INTO v_organizer_id
    FROM locations l
    WHERE l.id = v_location_id;

    -- Check if tenant is approved for this organizer
    IF EXISTS (
      SELECT 1 FROM tenant_organizers
      WHERE tenant_id = p_tenant_id
      AND organizer_id = v_organizer_id
      AND status IN ('approved', 'active')
    ) THEN
      -- If already active, skip
      IF EXISTS (
        SELECT 1 FROM tenant_locations
        WHERE tenant_id = p_tenant_id
        AND location_id = v_location_id
        AND is_active = TRUE
      ) THEN
        v_skipped_count := v_skipped_count + 1;

      -- If inactive record exists, reactivate it
      ELSIF EXISTS (
        SELECT 1 FROM tenant_locations
        WHERE tenant_id = p_tenant_id
        AND location_id = v_location_id
        AND is_active = FALSE
      ) THEN
        UPDATE tenant_locations
        SET is_active = TRUE,
            status = 'pending',
            organizer_id = v_organizer_id
        WHERE tenant_id = p_tenant_id
        AND location_id = v_location_id;
        v_inserted_count := v_inserted_count + 1;

      -- No record at all, insert fresh
      ELSE
        INSERT INTO tenant_locations (
          tenant_id,
          location_id,
          organizer_id,
          status,
          rate_type,
          is_active
        ) VALUES (
          p_tenant_id,
          v_location_id,
          v_organizer_id,
          'pending',
          'monthly',
          TRUE
        );
        v_inserted_count := v_inserted_count + 1;
      END IF;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'inserted', v_inserted_count,
    'skipped', v_skipped_count,
    'message', format('%s lokasi ditambah, %s dilangkau', v_inserted_count, v_skipped_count)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION add_tenant_locations(BIGINT, INTEGER[]) TO authenticated;
