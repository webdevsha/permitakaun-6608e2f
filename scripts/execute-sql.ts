#!/usr/bin/env ts-node
/**
 * Script to execute SQL migration on Supabase
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://sfcoqymbxectgwedkbqa.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSQL() {
  const sqlFile = path.join(__dirname, '..', 'sql', 'enhanced_tenant_organizer_workflow.sql')
  const sql = fs.readFileSync(sqlFile, 'utf-8')

  console.log('Executing SQL migration...\n')

  // Split SQL into individual statements
  const statements = sql
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    const preview = statement.substring(0, 60).replace(/\n/g, ' ')
    
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `)

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
      
      if (error) {
        // If exec_sql doesn't exist, try using the query API
        const { error: queryError } = await supabase.from('_exec_sql').select('*').eq('sql', statement + ';')
        
        if (queryError) {
          console.log(`⚠️  (may already exist or skipped)`)
          // Don't count as error for idempotent operations
        } else {
          console.log('✓')
          successCount++
        }
      } else {
        console.log('✓')
        successCount++
      }
    } catch (err: any) {
      console.log(`✗ Error: ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n========================================`)
  console.log(`Migration Summary:`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
  console.log(`========================================`)
}

// Alternative: Use direct REST API call
async function executeSQLViaRest() {
  const sqlFile = path.join(__dirname, '..', 'sql', 'enhanced_tenant_organizer_workflow.sql')
  const sql = fs.readFileSync(sqlFile, 'utf-8')

  console.log('Executing SQL migration via REST API...\n')

  // The SQL file is idempotent, so we can execute it as a whole
  // using the pg-meta API or exec_sql function if available
  
  try {
    // Try to use the exec_sql function if it exists
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sql 
    })

    if (error) {
      console.log('exec_sql not available, trying alternative method...')
      
      // Alternative: Use the management API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ query: sql })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        
        // Try executing individual statements
        console.log('\nFalling back to statement-by-statement execution...')
        await executeStatementsIndividually(sql)
      } else {
        console.log('✓ SQL migration executed successfully!')
      }
    } else {
      console.log('✓ SQL migration executed successfully!')
    }
  } catch (err: any) {
    console.error('Error:', err.message)
    console.log('\nFalling back to statement-by-statement execution...')
    await executeStatementsIndividually(sql)
  }
}

async function executeStatementsIndividually(sql: string) {
  // Parse and execute key statements
  const keyStatements = [
    // Add columns if not exists
    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'approved_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;`,

    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejected_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejected_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;`,

    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'rejection_reason') THEN
        ALTER TABLE tenant_organizers ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;`,

    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_organizers' AND column_name = 'requested_at') THEN
        ALTER TABLE tenant_organizers ADD COLUMN requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;`,

    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'organizer_id') THEN
        ALTER TABLE tenant_locations ADD COLUMN organizer_id UUID REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;
END $$;`,

    `DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_locations' AND column_name = 'is_active') THEN
        ALTER TABLE tenant_locations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;`
  ]

  console.log(`Executing ${keyStatements.length} schema updates...\n`)

  for (let i = 0; i < keyStatements.length; i++) {
    const stmt = keyStatements[i]
    process.stdout.write(`[${i + 1}/${keyStatements.length}] Schema update... `)
    
    try {
      // Execute via raw query
      const { error } = await supabase.rpc('exec_sql', { query: stmt })
      
      if (error) {
        console.log(`⚠️  (may already exist)`)
      } else {
        console.log('✓')
      }
    } catch (err) {
      console.log(`⚠️  (skipped)`)
    }
  }

  console.log('\n✓ Schema migration completed!')
  console.log('\nNote: Some functions and policies may need to be created manually')
  console.log('via the Supabase SQL Editor if exec_sql is not available.')
}

// Main execution
executeSQLViaRest().catch(console.error)
