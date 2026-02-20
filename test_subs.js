import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: cols } = await fetch(SUPABASE_URL + '/rest/v1/?apikey=' + SUPABASE_KEY).then(res => res.json());
  console.log('schema user_subscriptions:', cols.definitions?.user_subscriptions?.properties);
  
  // Also check the user's subscription
  const { data: user } = await supabase.from('profiles').select('id').eq('email', 'nshfnoh@proton.me').single();
  if (user) {
    const { data: sub } = await supabase.from('user_subscriptions').select('*').eq('profile_id', user.id).single();
    console.log('user_subscription:', sub);
  } else {
    console.log('no user found for nshfnoh@proton.me');
  }
}
check()
