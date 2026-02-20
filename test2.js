import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: p } = await supabase.from('profiles').select('*').limit(1)
  console.log('profiles keys:', p && p[0] ? Object.keys(p[0]) : 'no data')
  
  const { data: t } = await supabase.from('tenants').select('*').limit(1)
  console.log('tenants keys:', t && t[0] ? Object.keys(t[0]) : 'no data')
  
  const { data: o } = await supabase.from('organizers').select('*').limit(1)
  console.log('organizers keys:', o && o[0] ? Object.keys(o[0]) : 'no data')
}
check()
