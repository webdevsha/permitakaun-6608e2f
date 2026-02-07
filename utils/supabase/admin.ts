import { createClient } from '@supabase/supabase-js'

// Fallback to hardcoded values if env vars are not available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfcoqymbxectgwedkbqa.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export function createAdminClient() {
    if (!supabaseServiceKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined')
    }
    if (!supabaseUrl) {
        throw new Error('supabaseUrl is required')
    }
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
