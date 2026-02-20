import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data: user } = await supabase.from('profiles').select('id, email').eq('email', 'nshfnoh@proton.me').single();
  if (user) {
    const { data: sub } = await supabase.from('subscriptions').select('*').eq('profile_id', user.id).single();
    console.log('subscription:', sub);
    const { data: sub2 } = await supabase.from('user_subscriptions').select('*').eq('profile_id', user.id).single();
    console.log('user_subscriptions:', sub2);
  } else {
    console.log('no user found');
  }
}
check()
