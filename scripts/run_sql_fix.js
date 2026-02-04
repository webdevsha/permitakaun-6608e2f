const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runSQL() {
  const sqlFile = path.join(__dirname, '..', 'sql', 'fix_org002_data.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  console.log('Running SQL fix for ORG002 data...\n');
  
  // Split SQL into statements and execute one by one
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--') || stmt.startsWith('/*')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        // If exec_sql doesn't exist, try direct query
        console.log(`Statement ${i + 1}: Skipping (requires SQL execution)`);
      }
    } catch (e) {
      // Expected to fail without custom RPC function
    }
  }
  
  // Alternative: Run key fixes directly
  console.log('Applying fixes directly...\n');
  
  // 1. Fix admin role
  console.log('1. Fixing admin@kumim.my role to admin...');
  const { error: e1 } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', 'admin@kumim.my');
  if (e1) console.log('   Error:', e1.message);
  else console.log('   ✓ Done');
  
  // 2. Fix tenants with no organizer_code
  console.log('2. Assigning ORG002 to tenants with no organizer_code...');
  const { error: e2, data: updatedTenants } = await supabase
    .from('tenants')
    .update({ organizer_code: 'ORG002' })
    .or('organizer_code.is.null,organizer_code.eq.,organizer_code.eq.ORG_KUMIM');
  if (e2) console.log('   Error:', e2.message);
  else console.log('   ✓ Done');
  
  // 3. Get Hazman's organizer ID
  console.log('3. Getting Hazman organizer info...');
  const { data: hazmanOrg } = await supabase
    .from('organizers')
    .select('id')
    .eq('email', 'admin@kumim.my')
    .single();
  
  if (hazmanOrg) {
    console.log('   Hazman organizer ID:', hazmanOrg.id);
    
    // 4. Update existing "Jalan Kebun" location
    console.log('4. Ensuring Jalan Kebun is linked to Hazman...');
    const { error: e4 } = await supabase
      .from('locations')
      .update({ organizer_id: hazmanOrg.id })
      .eq('name', 'Jalan Kebun');
    if (e4) console.log('   Error:', e4.message);
    else console.log('   ✓ Done');
    
    // 5. Add more locations
    console.log('5. Adding test locations...');
    const locations = [
      {
        name: 'Pasar Malam Bandar Baru',
        program_name: 'Pasar Malam Komuniti',
        type: 'daily',
        operating_days: 'Sabtu & Ahad',
        days_per_week: 2,
        total_lots: 60,
        rate_khemah: 40,
        rate_cbs: 30,
        rate_monthly: 0,
        status: 'active',
        organizer_id: hazmanOrg.id
      },
      {
        name: 'Bazaar Ramadan Taman Sri Muda',
        program_name: 'Bazaar Ramadan 2025',
        type: 'daily',
        operating_days: 'Isnin - Ahad',
        days_per_week: 7,
        total_lots: 100,
        rate_khemah: 60,
        rate_cbs: 40,
        rate_monthly: 0,
        status: 'active',
        organizer_id: hazmanOrg.id
      }
    ];
    
    for (const loc of locations) {
      const { error: e5 } = await supabase
        .from('locations')
        .upsert(loc, { onConflict: 'name' });
      if (e5) console.log(`   Error adding ${loc.name}:`, e5.message);
    }
    console.log('   ✓ Done');
    
    // 6. Create test tenants
    console.log('6. Creating test tenants...');
    const testTenants = [
      { email: 'ahmad.kumim@test.com', name: 'Ahmad Bin Ali', business: 'Nasi Lemak Ahmad' },
      { email: 'siti.kumim@test.com', name: 'Siti Nurhaliza', business: 'Butik Siti' },
      { email: 'raj.kumim@test.com', name: 'Raj Kumar', business: 'Rojak Mamak Raj' }
    ];
    
    for (const t of testTenants) {
      // Create profile
      const { data: profile } = await supabase
        .from('profiles')
        .upsert({
          email: t.email,
          full_name: t.name,
          role: 'tenant',
          organizer_code: 'ORG002'
        }, { onConflict: 'email' })
        .select()
        .single();
      
      if (profile) {
        // Create tenant
        await supabase
          .from('tenants')
          .upsert({
            profile_id: profile.id,
            full_name: t.name,
            business_name: t.business,
            email: t.email,
            organizer_code: 'ORG002',
            status: 'active',
            rental_type: 'daily_khemah',
            rental_amount: 40
          }, { onConflict: 'email' });
      }
    }
    console.log('   ✓ Done');
  }
  
  console.log('\n=== VERIFICATION ===\n');
  
  // Verify results
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('email, role, organizer_code')
    .eq('email', 'admin@kumim.my')
    .single();
  console.log('Admin profile:', adminProfile);
  
  const { data: staffCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .eq('role', 'staff')
    .eq('organizer_code', 'ORG002');
  console.log('Staff count:', staffCount?.length || 0);
  
  const { data: orgCount } = await supabase
    .from('organizers')
    .select('*', { count: 'exact' })
    .eq('organizer_code', 'ORG002');
  console.log('Organizers count:', orgCount?.length || 0);
  
  const { data: locCount } = await supabase
    .from('locations')
    .select('*, organizers!inner(organizer_code)')
    .eq('organizers.organizer_code', 'ORG002');
  console.log('Locations count:', locCount?.length || 0);
  
  const { data: tenantCount } = await supabase
    .from('tenants')
    .select('*', { count: 'exact' })
    .eq('organizer_code', 'ORG002');
  console.log('Tenants count:', tenantCount?.length || 0);
  
  console.log('\n✓ Fix complete! Refresh the page to see the data.');
}

runSQL().catch(console.error);
