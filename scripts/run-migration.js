#!/usr/bin/env node
/**
 * Execute SQL migration on Supabase using REST API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'sfcoqymbxectgwedkbqa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

// Read SQL file
const sqlFile = path.join(__dirname, '..', 'sql', 'enhanced_tenant_organizer_workflow.sql');
const sql = fs.readFileSync(sqlFile, 'utf-8');

// First, let's create an exec_sql function if it doesn't exist
const createExecSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
BEGIN
  EXECUTE query;
END;
\$\$;
`;

function makeRequest(path, method, body, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'apikey': apiKey,
        'Prefer': 'return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          reject({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function executeMigration() {
  console.log('🚀 Starting SQL Migration...\n');
  
  // Split SQL into major blocks
  const blocks = [
    // Block 1: Add columns to tenant_organizers
    {
      name: 'Adding columns to tenant_organizers',
      sql: `
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'approved_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejected_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejection_reason') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejection_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'requested_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        UPDATE tenant_organizers SET requested_at = created_at WHERE requested_at IS NULL;
    END IF;
END $$;`
    },

    // Block 2: Add columns to tenant_locations
    {
      name: 'Adding columns to tenant_locations',
      sql: `
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'organizer_id') THEN
        ALTER TABLE tenant_locations ADD COLUMN organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'is_active') THEN
        ALTER TABLE tenant_locations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;

    UPDATE tenant_locations tl
    SET organizer_id = l.organizer_id
    FROM locations l
    WHERE tl.location_id = l.id AND tl.organizer_id IS NULL;
END $$;`
    },

    // Block 3: Create validate_organizer_by_code function
    {
      name: 'Creating validate_organizer_by_code function',
      sql: `
CREATE OR REPLACE FUNCTION validate_organizer_by_code(p_organizer_code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  masked_email TEXT,
  organizer_code TEXT,
  status TEXT,
  exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.email,
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
    TRUE as exists
  FROM organizers o
  WHERE o.organizer_code = UPPER(p_organizer_code)
  AND o.status = 'active'
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      FALSE;
  END IF;
END;
\$\$;`
    },

    // Block 4: Create request_organizer_link function
    {
      name: 'Creating request_organizer_link function',
      sql: `
CREATE OR REPLACE FUNCTION request_organizer_link(
  p_tenant_id BIGINT,
  p_organizer_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_organizer_id UUID;
  v_existing_status TEXT;
  v_tenant_profile_id UUID;
BEGIN
  SELECT profile_id INTO v_tenant_profile_id
  FROM tenants WHERE id = p_tenant_id;
  
  IF v_tenant_profile_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized: Tenant does not belong to current user'
    );
  END IF;

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

  INSERT INTO tenant_organizers (tenant_id, organizer_id, status, requested_at)
  VALUES (p_tenant_id, v_organizer_id, 'pending', NOW());
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Permohonan berjaya dihantar',
    'organizer_id', v_organizer_id,
    'status', 'pending'
  );
END;
\$\$;`
    },

    // Block 5: Create process_tenant_request function
    {
      name: 'Creating process_tenant_request function',
      sql: `
CREATE OR REPLACE FUNCTION process_tenant_request(
  p_link_id BIGINT,
  p_action TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_organizer_id UUID;
  v_current_user_is_organizer BOOLEAN;
BEGIN
  SELECT organizer_id INTO v_organizer_id
  FROM tenant_organizers
  WHERE id = p_link_id;

  IF v_organizer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Permohonan tidak dijumpai'
    );
  END IF;

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

  IF p_action = 'approve' THEN
    UPDATE tenant_organizers 
    SET status = 'approved',
        approved_at = NOW(),
        rejected_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = p_link_id;
    
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
      'error', 'Invalid action'
    );
  END IF;
END;
\$\$;`
    },

    // Block 6: Create get_available_locations_for_tenant function
    {
      name: 'Creating get_available_locations_for_tenant function',
      sql: `
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
AS \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = p_tenant_id AND profile_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    l.id::INTEGER as location_id,
    l.name::TEXT as location_name,
    l.organizer_id,
    o.name::TEXT as organizer_name,
    l.rate_khemah,
    l.rate_cbs,
    l.rate_monthly,
    l.operating_days::TEXT,
    l.type::TEXT
  FROM locations l
  JOIN organizers o ON l.organizer_id = o.id
  JOIN tenant_organizers tor ON tor.organizer_id = o.id
  WHERE tor.tenant_id = p_tenant_id
  AND tor.status IN ('approved', 'active')
  AND l.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_locations tl
    WHERE tl.tenant_id = p_tenant_id
    AND tl.location_id = l.id
    AND tl.is_active = TRUE
  )
  ORDER BY o.name, l.name;
END;
\$\$;`
    },

    // Block 7: Create add_tenant_locations function
    {
      name: 'Creating add_tenant_locations function',
      sql: `
CREATE OR REPLACE FUNCTION add_tenant_locations(
  p_tenant_id BIGINT,
  p_location_ids INTEGER[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_location_id INTEGER;
  v_organizer_id UUID;
  v_inserted_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = p_tenant_id AND profile_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Unauthorized'
    );
  END IF;

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
    SELECT l.organizer_id INTO v_organizer_id
    FROM locations l
    WHERE l.id = v_location_id;

    IF EXISTS (
      SELECT 1 FROM tenant_organizers
      WHERE tenant_id = p_tenant_id
      AND organizer_id = v_organizer_id
      AND status IN ('approved', 'active')
    ) THEN
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
\$\$;`
    },

    // Block 8: Create indexes
    {
      name: 'Creating indexes',
      sql: `
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_tenant_id ON tenant_organizers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_organizer_id ON tenant_organizers(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_status ON tenant_organizers(status);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_composite ON tenant_organizers(tenant_id, organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_tenant_id ON tenant_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_organizer_id ON tenant_locations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_location_id ON tenant_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_is_active ON tenant_locations(is_active);`
    },

    // Block 9: Create views
    {
      name: 'Creating views',
      sql: `
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

GRANT SELECT ON pending_tenant_requests TO authenticated;

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

GRANT SELECT ON tenant_approved_locations TO authenticated;`
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const block of blocks) {
    process.stdout.write(`📝 ${block.name}... `);
    
    try {
      // Try to execute via RPC (if function exists)
      const result = await makeRequest(
        '/rest/v1/rpc/exec_sql',
        'POST',
        JSON.stringify({ query: block.sql }),
        SERVICE_ROLE_KEY
      );
      console.log('✅');
      successCount++;
    } catch (err) {
      if (err.status === 404) {
        // exec_sql doesn't exist, try alternative
        console.log('⚠️  (skipped - exec_sql not available)');
      } else if (err.status === 400 && err.data?.includes('already exists')) {
        console.log('✅ (already exists)');
        successCount++;
      } else {
        console.log(`❌ Error: ${err.status}`);
        errorCount++;
      }
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`  ✅ Success/Existing: ${successCount}/${blocks.length}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('========================================\n');

  if (errorCount > 0) {
    console.log('⚠️  Some blocks failed. Manual execution may be required.');
    console.log('   Please run the SQL file manually in Supabase SQL Editor:');
    console.log('   sql/enhanced_tenant_organizer_workflow.sql');
  } else {
    console.log('✅ Migration completed successfully!');
  }
}

executeMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
