import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data, error } = await supabase.from('organizers').insert({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test',
    email: 'test@test.com',
    organizer_code: 'ORGTEST99',
    status: 'pending'
  });
  console.log('insert error:', error);
}
check()
