import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: user } = await supabase.from('profiles').select('id, email, role').eq('email', 'nshfnoh@proton.me').single();
  if (user) {
    console.log('User:', user);
    const { data: tenant } = await supabase.from('tenants').select('id').eq('profile_id', user.id).single();
    if (tenant) {
      console.log('Tenant:', tenant);
      const { data: sub } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenant.id);
      console.log('Subscriptions:', sub);
    }
    const { data: org } = await supabase.from('organizers').select('id').eq('profile_id', user.id).single();
    if (org) {
       const { data: sub } = await supabase.from('subscriptions').select('*').eq('organizer_id', org.id);
       console.log('Org Subscriptions:', sub);
    }
  }
}
check()
