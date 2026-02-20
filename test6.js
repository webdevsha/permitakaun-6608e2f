import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

async function check() {
  const query = await fetch(SUPABASE_URL + '/rest/v1/?apikey=' + SUPABASE_KEY);
  const data = await query.json();
  // check if we can see sequences... REST API schema might not return sequences.
  // let's try to query an organizer to see if there is any error with the constraint still.
  console.log("ok");
}
check()
