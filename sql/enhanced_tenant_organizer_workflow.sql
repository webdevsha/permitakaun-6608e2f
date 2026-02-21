-- ============================================================================
-- ENHANCED TENANT-ORGANIZER APPROVAL WORKFLOW
-- ============================================================================
-- This migration enhances the existing tenant_organizers table and adds
-- necessary support tables for the complete approval workflow.

-- ============================================================================
-- 1. UPDATE EXISTING TENANT_ORGANIZERS TABLE
-- ============================================================================

-- Add additional columns if they don't exist
DO $$
BEGIN
    -- Add approved_at timestamp
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'approved_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add rejected_at timestamp  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejected_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add rejection_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejection_reason') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejection_reason TEXT;
    END IF;

    -- Add requested_at (default to created_at for existing records)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'requested_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        -- Update existing records to use created_at
        UPDATE tenant_organizers SET requested_at = created_at WHERE requested_at IS NULL;
    END IF;

    -- Ensure status column accepts 'approved' value (in addition to 'active')
    -- Note: Existing data with 'active' will continue to work
EXCEPTION
    WHEN duplicate_column THEN
        NULL;
END $$;

-- ============================================================================
-- 2. UPDATE TENANT_LOCATIONS TABLE
-- ============================================================================

DO $$
BEGIN
    -- Add organizer_id reference if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'organizer_id') THEN
        ALTER TABLE tenant_locations ADD COLUMN organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;

    -- Add is_active flag for soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'is_active') THEN
        ALTER TABLE tenant_locations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    -- Backfill organizer_id from location's organizer
    UPDATE tenant_locations tl
    SET organizer_id = l.organizer_id
    FROM locations l
    WHERE tl.location_id = l.id AND tl.organizer_id IS NULL;

EXCEPTION
    WHEN duplicate_column THEN
        NULL;
END $$;

-- ============================================================================
-- 3. UPDATE RLS POLICIES
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE tenant_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Tenants can insert own requests" ON tenant_organizers;
DROP POLICY IF EXISTS "Tenants can view own requests" ON tenant_organizers;
DROP POLICY IF EXISTS "Organizers can view requests for themselves" ON tenant_organizers;
DROP POLICY IF EXISTS "Organizers can update status" ON tenant_organizers;
DROP POLICY IF EXISTS "Admins can manage all tenant organizer requests" ON tenant_organizers;

-- Policy: Tenants can view their own requests
CREATE POLICY "Tenants can view own requests" ON tenant_organizers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE tenants.id = tenant_organizers.tenant_id 
      AND tenants.profile_id = auth.uid()
    )
  );

-- Policy: Tenants can insert (request to join)
CREATE POLICY "Tenants can insert own requests" ON tenant_organizers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE tenants.id = tenant_organizers.tenant_id 
      AND tenants.profile_id = auth.uid()
    )
  );

-- Policy: Organizers can view requests for themselves
CREATE POLICY "Organizers can view requests for themselves" ON tenant_organizers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizers 
      WHERE organizers.id = tenant_organizers.organizer_id 
      AND organizers.profile_id = auth.uid()
    )
  );

-- Policy: Organizers can update status (approve/reject)
CREATE POLICY "Organizers can update status" ON tenant_organizers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organizers 
      WHERE organizers.id = tenant_organizers.organizer_id 
      AND organizers.profile_id = auth.uid()
    )
  );

-- Policy: Admins can manage all tenant organizer requests
CREATE POLICY "Admins can manage all tenant organizer requests" ON tenant_organizers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Tenant Locations Policies
DROP POLICY IF EXISTS "Tenants can view own locations" ON tenant_locations;
DROP POLICY IF EXISTS "Tenants can insert own locations" ON tenant_locations;
DROP POLICY IF EXISTS "Organizers can view tenant locations" ON tenant_locations;
DROP POLICY IF EXISTS "Organizers can update tenant locations" ON tenant_locations;

-- Policy: Tenants can view their assigned locations
CREATE POLICY "Tenants can view own locations" ON tenant_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE tenants.id = tenant_locations.tenant_id 
      AND tenants.profile_id = auth.uid()
    )
  );

-- Policy: Tenants can request locations (insert with pending status)
CREATE POLICY "Tenants can insert own locations" ON tenant_locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenants 
      WHERE tenants.id = tenant_locations.tenant_id 
      AND tenants.profile_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tenant_organizers
      WHERE tenant_organizers.tenant_id = tenant_locations.tenant_id
      AND tenant_organizers.organizer_id = tenant_locations.organizer_id
      AND tenant_organizers.status IN ('active', 'approved')
    )
  );

-- Policy: Organizers can view their tenant locations
CREATE POLICY "Organizers can view tenant locations" ON tenant_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizers 
      WHERE organizers.id = tenant_locations.organizer_id 
      AND organizers.profile_id = auth.uid()
    )
  );

-- Policy: Organizers can update their tenant locations
CREATE POLICY "Organizers can update tenant locations" ON tenant_locations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organizers 
      WHERE organizers.id = tenant_locations.organizer_id 
      AND organizers.profile_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. FUNCTIONS FOR WORKFLOW
-- ============================================================================

-- Function: Validate organizer by code and return masked info
CREATE OR REPLACE FUNCTION validate_organizer_by_code(p_organizer_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  masked_email TEXT,
  organizer_code TEXT,
  status TEXT,
  organizer_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.email,
    -- Mask email: show first 2 chars and domain only
    CASE 
      WHEN o.email IS NULL THEN NULL
      ELSE CONCAT(
        LEFT(o.email, 2),
        '***@',
        SPLIT_PART(SPLIT_PART(o.email, '@', 2), '.', 1),
        '.***'
      )
    END as masked_email,
    o.organizer_code,
    o.status,
    TRUE as organizer_exists
  FROM organizers o
  WHERE o.organizer_code = UPPER(p_organizer_code)
  AND o.status = 'active'
  LIMIT 1;
  
  -- If no rows returned, the organizer doesn't exist
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      FALSE as organizer_exists;
  END IF;
END;
$$;

-- Function: Request organizer link (with duplicate prevention)
CREATE OR REPLACE FUNCTION request_organizer_link(
  p_tenant_id BIGINT,
  p_organizer_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organizer_id UUID;
  v_existing_status TEXT;
  v_tenant_profile_id UUID;
BEGIN
  -- Verify tenant belongs to current user
  SELECT profile_id INTO v_tenant_profile_id
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_tenant_profile_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized: Tenant does not belong to current user'
    );
  END IF;

  -- Find Organizer by Code
  SELECT id INTO v_organizer_id
  FROM organizers
  WHERE organizer_code = UPPER(p_organizer_code)
  AND status = 'active';

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Kod Penganjur tidak sah atau penganjur tidak aktif'
    );
  END IF;

  -- Check if already linked
  SELECT status INTO v_existing_status
  FROM tenant_organizers 
  WHERE tenant_id = p_tenant_id AND organizer_id = v_organizer_id;

  IF v_existing_status IS NOT NULL THEN
    IF v_existing_status = 'pending' THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Permohonan masih dalam semakan',
        'status', v_existing_status
      );
    ELSIF v_existing_status IN ('active', 'approved') THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Anda telah diluluskan oleh penganjur ini',
        'status', v_existing_status
      );
    ELSIF v_existing_status = 'rejected' THEN
      -- Allow re-request after rejection (update status back to pending)
      UPDATE tenant_organizers 
      SET status = 'pending', 
          requested_at = NOW(),
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
      WHERE tenant_id = p_tenant_id AND organizer_id = v_organizer_id;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Permohonan baharu dihantar',
        'organizer_id', v_organizer_id,
        'status', 'pending'
      );
    END IF;
  END IF;

  -- Insert new link
  INSERT INTO tenant_organizers (tenant_id, organizer_id, status, requested_at)
  VALUES (p_tenant_id, v_organizer_id, 'pending', NOW());
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Permohonan berjaya dihantar',
    'organizer_id', v_organizer_id,
    'status', 'pending'
  );
END;
$$;

-- Function: Approve or reject tenant request
CREATE OR REPLACE FUNCTION process_tenant_request(
  p_link_id BIGINT,
  p_action TEXT, -- 'approve' or 'reject'
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organizer_id UUID;
  v_tenant_id BIGINT;
  v_organizer_code TEXT;
  v_current_user_is_organizer BOOLEAN;
BEGIN
  -- Get the organizer_id and tenant_id for this link
  SELECT organizer_id, tenant_id INTO v_organizer_id, v_tenant_id
  FROM tenant_organizers
  WHERE id = p_link_id;

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Permohonan tidak dijumpai'
    );
  END IF;

  -- Check if current user is the organizer or admin
  SELECT EXISTS(
    SELECT 1 FROM organizers 
    WHERE id = v_organizer_id AND profile_id = auth.uid()
  ) OR EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  ) INTO v_current_user_is_organizer;

  IF NOT v_current_user_is_organizer THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized: You cannot process this request'
    );
  END IF;

  -- Process the request
  IF p_action = 'approve' THEN
    -- Get the organizer_code for this organizer
    SELECT organizer_code INTO v_organizer_code
    FROM organizers
    WHERE id = v_organizer_id;

    -- Update tenant_organizers status
    UPDATE tenant_organizers 
    SET status = 'approved',
        approved_at = NOW(),
        rejected_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_link_id;
    
    -- ALSO update the tenant's organizer_code so triggers can find the organizer
    UPDATE tenants
    SET organizer_code = v_organizer_code,
        updated_at = NOW()
    WHERE id = v_tenant_id;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Permohonan diluluskan',
      'status', 'approved'
    );
  ELSIF p_action = 'reject' THEN
    UPDATE tenant_organizers 
    SET status = 'rejected',
        rejected_at = NOW(),
        rejection_reason = p_rejection_reason,
        approved_at = NULL,
        updated_at = NOW()
    WHERE id = p_link_id;
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Permohonan ditolak',
      'status', 'rejected'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid action. Use approve or reject.'
    );
  END IF;
END;
$$;

-- Function: Get available locations for tenant (only from approved organizers)
CREATE OR REPLACE FUNCTION get_available_locations_for_tenant(p_tenant_id BIGINT)
RETURNS TABLE (
  location_id INTEGER,
  location_name TEXT,
  organizer_id UUID,
  organizer_name TEXT,
  rate_khemah NUMERIC,
  rate_cbs NUMERIC,
  rate_monthly NUMERIC,
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
    l.organizer_id,
    o.name as organizer_name,
    l.rate_khemah,
    l.rate_cbs,
    l.rate_monthly,
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
  ORDER BY o.name, l.name;
END;
$$;

-- Function: Add multiple locations to tenant (bulk insert)
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
      -- Check if not already exists
      IF NOT EXISTS (
        SELECT 1 FROM tenant_locations
        WHERE tenant_id = p_tenant_id
        AND location_id = v_location_id
      ) THEN
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
      ELSE
        v_skipped_count := v_skipped_count + 1;
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

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_organizers_tenant_id ON tenant_organizers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_organizer_id ON tenant_organizers(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_status ON tenant_organizers(status);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_composite ON tenant_organizers(tenant_id, organizer_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_locations_tenant_id ON tenant_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_organizer_id ON tenant_locations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_location_id ON tenant_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_is_active ON tenant_locations(is_active);

-- ============================================================================
-- 6. TRIGGER TO CASCADE DELETE RELATIONS WHEN ORGANIZER IS DELETED
-- ============================================================================

-- This is handled by ON DELETE CASCADE on the foreign key
-- Additional cleanup trigger if needed:

CREATE OR REPLACE FUNCTION cleanup_tenant_locations_on_organizer_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark tenant locations as inactive when organizer is deleted
  UPDATE tenant_locations
  SET is_active = FALSE
  WHERE organizer_id = OLD.id;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cleanup_on_organizer_delete ON organizers;
CREATE TRIGGER trigger_cleanup_on_organizer_delete
  BEFORE DELETE ON organizers
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_tenant_locations_on_organizer_delete();

-- ============================================================================
-- 7. VIEW FOR PENDING REQUESTS (Organizer Dashboard)
-- ============================================================================

CREATE OR REPLACE VIEW pending_tenant_requests AS
SELECT 
  tor.id as request_id,
  tor.tenant_id,
  tor.organizer_id,
  tor.status,
  tor.requested_at,
  t.full_name as tenant_name,
  t.business_name as tenant_business,
  t.phone_number as tenant_phone,
  t.email as tenant_email,
  t.ic_number as tenant_ic,
  o.name as organizer_name,
  o.organizer_code
FROM tenant_organizers tor
JOIN tenants t ON tor.tenant_id = t.id
JOIN organizers o ON tor.organizer_id = o.id
WHERE tor.status = 'pending'
ORDER BY tor.requested_at DESC;

-- Grant access to the view
GRANT SELECT ON pending_tenant_requests TO authenticated;

-- ============================================================================
-- 8. VIEW FOR TENANT'S APPROVED ORGANIZERS AND LOCATIONS
-- ============================================================================

CREATE OR REPLACE VIEW tenant_approved_locations AS
SELECT 
  tl.id as tenant_location_id,
  tl.tenant_id,
  tl.location_id,
  tl.organizer_id,
  tl.status as rental_status,
  tl.rate_type,
  tl.stall_number,
  tl.is_active,
  l.name as location_name,
  l.operating_days,
  l.rate_khemah,
  l.rate_cbs,
  l.rate_monthly,
  o.name as organizer_name,
  o.organizer_code,
  tor.status as approval_status
FROM tenant_locations tl
JOIN locations l ON tl.location_id = l.id
JOIN organizers o ON tl.organizer_id = o.id
JOIN tenant_organizers tor ON tor.tenant_id = tl.tenant_id AND tor.organizer_id = tl.organizer_id
WHERE tor.status IN ('approved', 'active')
AND tl.is_active = TRUE;

GRANT SELECT ON tenant_approved_locations TO authenticated;
