import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('tenant_locations').select('*').order('created_at', { ascending: false }).limit(5)
  console.log("Recent tenant_locations:")
  console.dir(data, { depth: null })
  if (error) console.error(error)
}

run()
