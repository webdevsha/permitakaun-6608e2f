/**
 * Server-side Supabase client with request-scoped caching
 * Prevents multiple client instantiations during a single request
 */
import { createClient as createServerClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"

// Use Next.js async request storage (implicit in server components)
// This cache persists for the duration of a single request
const clientCache = new Map<string, any>()

export async function getCachedClient() {
  const cacheKey = 'supabase-client'
  
  if (!clientCache.has(cacheKey)) {
    const client = await createServerClient()
    clientCache.set(cacheKey, client)
  }
  
  return clientCache.get(cacheKey)
}

export async function getCachedUserRole() {
  const cacheKey = 'user-role'
  
  if (!clientCache.has(cacheKey)) {
    const supabase = await getCachedClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return { user: null, role: null, profile: null, error: userError }
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organizer_code, full_name, email')
      .eq('id', user.id)
      .single()
    
    const role = determineUserRole(profile, user.email)
    
    const result = { 
      user, 
      role, 
      profile: profile || null,
      error: profileError 
    }
    
    clientCache.set(cacheKey, result)
    return result
  }
  
  return clientCache.get(cacheKey)
}

// Clear cache (useful for testing or after mutations)
export function clearServerCache() {
  clientCache.clear()
}
