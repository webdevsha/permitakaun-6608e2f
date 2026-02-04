const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkDatabase() {
  console.log('=== DATABASE INVESTIGATION ===\n');

  // 1. Check admin@kumim.my profile
  console.log('1. admin@kumim.my PROFILE:');
  const { data: adminProfile, error: adminError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'admin@kumim.my')
    .single();
  if (adminError) console.error('Error fetching admin profile:', adminError);
  console.log(adminProfile);
  console.log('');

  // 2. Check admin@kumim.my organizer record
  console.log('2. admin@kumim.my ORGANIZER RECORD:');
  const { data: adminOrg } = await supabase
    .from('organizers')
    .select('*')
    .eq('email', 'admin@kumim.my')
    .single();
  console.log(adminOrg);
  console.log('');

  // 3. Check all organizers
  console.log('3. ALL ORGANIZERS:');
  const { data: allOrgs } = await supabase
    .from('organizers')
    .select('*')
    .order('created_at', { ascending: false });
  console.log(allOrgs);
  console.log('');

  // 4. Check staff with ORG002
  console.log('4. STAFF WITH ORG002:');
  const { data: staff002 } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'staff')
    .eq('organizer_code', 'ORG002');
  console.log(staff002);
  console.log('');

  // 5. Check all staff
  console.log('5. ALL STAFF:');
  const { data: allStaff } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, organizer_code')
    .eq('role', 'staff');
  console.log(allStaff);
  console.log('');

  // 6. Check tenants with ORG002
  console.log('6. TENANTS WITH ORG002:');
  const { data: tenants002 } = await supabase
    .from('tenants')
    .select('*')
    .eq('organizer_code', 'ORG002');
  console.log(tenants002);
  console.log('');

  // 7. Check all tenants with organizer codes
  console.log('7. ALL TENANTS (with org codes):');
  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id, full_name, business_name, organizer_code, email')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(allTenants);
  console.log('');

  // 8. Check locations
  console.log('8. ALL LOCATIONS:');
  const { data: allLocs } = await supabase
    .from('locations')
    .select('*, organizers(id, email, organizer_code)')
    .order('created_at', { ascending: false });
  console.log(JSON.stringify(allLocs, null, 2));
  console.log('');

  // 9. Check transactions for ORG002 tenants
  console.log('9. TRANSACTIONS FOR ORG002 TENANTS:');
  const { data: org002Tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('organizer_code', 'ORG002');

  if (org002Tenants && org002Tenants.length > 0) {
    const tenantIds = org002Tenants.map(t => t.id);
    const { data: tx002 } = await supabase
      .from('transactions')
      .select('*')
      .in('tenant_id', tenantIds)
      .limit(10);
    console.log(tx002);
  } else {
    console.log('No ORG002 tenants found');
  }
  console.log('');

  // 10. Check all organizer codes in use
  console.log('10. ALL UNIQUE ORGANIZER_CODES:');
  const { data: orgCodes } = await supabase
    .from('profiles')
    .select('organizer_code, count(*)')
    .not('organizer_code', 'is', null)
    .group('organizer_code');
  console.log(orgCodes);
  console.log('');

  // 11. Check RLS policies
  console.log('11. RLS POLICIES ON ORGANIZERS:');
  const { data: rlsPolicies } = await supabase
    .rpc('get_policies', { table_name: 'organizers' })
    .catch(() => ({ data: null }));
  console.log(rlsPolicies || 'Cannot query policies via RPC');
}

checkDatabase().catch(console.error);
