import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

async function check() {
  const query = await fetch(SUPABASE_URL + '/rest/v1/?apikey=' + SUPABASE_KEY);
  const data = await query.json();
  // We can also just try a sign up and grab the exact error since Supabase Auth returns standard messages.
  // Wait, signUp is the only way to fire the auth.users trigger
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: d, error } = await supabase.auth.signUp({
    email: 'test_organizer_5@test.com',
    password: 'password123',
    options: {
      data: {
        role: 'organizer',
        full_name: 'Test Org 5'
      }
    }
  });
  console.log('signUp return:', error);
}
check()
