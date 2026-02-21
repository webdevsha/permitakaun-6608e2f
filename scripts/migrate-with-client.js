#!/usr/bin/env node
/**
 * Execute SQL migration using Supabase client
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://sfcoqymbxectgwedkbqa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeWithRetry(operation, name, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();
      return result;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.log(`  Retry ${i + 1}/${maxRetries} for ${name}...`);
      await sleep(1000);
    }
  }
}

async function runMigration() {
  console.log('🚀 Starting SQL Migration via Supabase Client...\n');

  const migrationBlocks = [
    {
      name: 'Add columns to tenant_organizers',
      sql: `DO $$
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
    {
      name: 'Add columns to tenant_locations',
      sql: `DO $$
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
    {
      name: 'Create validate_organizer_by_code function',
      sql: `CREATE OR REPLACE FUNCTION validate_organizer_by_code(p_organizer_code TEXT)
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
    {
      name: 'Create request_organizer_link function',
      sql: `CREATE OR REPLACE FUNCTION request_organizer_link(
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
    {
      name: 'Create process_tenant_request function',
      sql: `CREATE OR REPLACE FUNCTION process_tenant_request(
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
    {
      name: 'Create get_available_locations_for_tenant function',
      sql: `CREATE OR REPLACE FUNCTION get_available_locations_for_tenant(p_tenant_id BIGINT)
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
    {
      name: 'Create add_tenant_locations function',
      sql: `CREATE OR REPLACE FUNCTION add_tenant_locations(
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
    {
      name: 'Create indexes',
      sql: `CREATE INDEX IF NOT EXISTS idx_tenant_organizers_tenant_id ON tenant_organizers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_organizer_id ON tenant_organizers(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_status ON tenant_organizers(status);
CREATE INDEX IF NOT EXISTS idx_tenant_organizers_composite ON tenant_organizers(tenant_id, organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_tenant_id ON tenant_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_organizer_id ON tenant_locations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_location_id ON tenant_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_locations_is_active ON tenant_locations(is_active);`
    },
    {
      name: 'Create views',
      sql: `CREATE OR REPLACE VIEW pending_tenant_requests AS
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

  for (const block of migrationBlocks) {
    process.stdout.write(`📝 ${block.name}... `);
    
    try {
      // Try to use exec_sql via RPC
      const { error } = await supabase.rpc('exec_sql', { 
        query: block.sql 
      });
      
      if (error) {
        // If error mentions function doesn't exist, try direct query via table.insert
        if (error.message && error.message.includes('function') && error.message.includes('does not exist')) {
          console.log('⚠️  (exec_sql not available, need manual execution)');
        } else if (error.message && error.message.includes('already exists')) {
          console.log('✅ (already exists)');
          successCount++;
        } else {
          console.log(`⚠️  (${error.message.substring(0, 50)}...)`);
          errorCount++;
        }
      } else {
        console.log('✅');
        successCount++;
      }
    } catch (err) {
      console.log(`⚠️  (skipped)`);
      errorCount++;
    }
    
    await sleep(500);
  }

  console.log('\n========================================');
  console.log('Migration Summary:');
  console.log(`  ✅ Success/Existing: ${successCount}/${migrationBlocks.length}`);
  console.log(`  ⚠️  Need Manual: ${errorCount}`);
  console.log('========================================\n');

  if (errorCount > 0) {
    console.log('⚠️  Some components require manual execution.');
    console.log('   Please run the SQL file in Supabase SQL Editor:\n');
    console.log('   📁 File: sql/enhanced_tenant_organizer_workflow.sql');
    console.log('   🔗 URL: https://supabase.com/dashboard/project/sfcoqymbxectgwedkbqa/sql');
    console.log('');
  } else {
    console.log('✅ Migration completed successfully!');
  }
}

// Test connection first
async function testConnection() {
  console.log('🔗 Testing Supabase connection...');
  const { data, error } = await supabase.from('organizers').select('count').limit(1);
  if (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Connection successful\n');
}

async function main() {
  await testConnection();
  await runMigration();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
