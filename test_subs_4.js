import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: user } = await supabase.from('profiles').select('id, email, role').eq('email', 'nshfnoh@proton.me').single();
  const { data: tenantTx } = await supabase.from('tenant_transactions').select('*').eq('tenant_id', 44).eq('category', 'Langganan');
  console.log('Tenant Langganan Transactions:', tenantTx);
}
check()
