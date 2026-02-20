import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  console.log('profiles error?', error)
  const { data: d2, error: e2 } = await supabase.from('tenants').select('*').limit(1)
  console.log('tenants error?', e2)
  const { data: d3, error: e3 } = await supabase.from('organizers').select('*').limit(1)
  console.log('organizers error?', e3)
}
check()
