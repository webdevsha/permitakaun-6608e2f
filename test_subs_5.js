import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: user } = await supabase.from('profiles').select('id, email, role').eq('email', 'nshfnoh@proton.me').single();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('profile_id', user.id).single();
  
  if (tenant) {
    // delete old to avoid errors
    await supabase.from('subscriptions').delete().eq('tenant_id', tenant.id);
    
    const now = new Date()
    const endDate = new Date()
    endDate.setDate(now.getDate() + 30)

    const { error: insertErr } = await supabase.from('subscriptions').insert({
      tenant_id: tenant.id,
      plan_type: 'enterprise',
      status: 'active',
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      amount: 19,
      payment_ref: 'admin_test_123'
    });
    
    console.log('Insert Error?', insertErr);
    console.log('Assigned enterprise to nshfnoh@proton.me');
  }
}
check()
