import { createClient } from "@/utils/supabase/client"
import { getTrialPeriod } from "@/actions/settings"
import { checkSubscriptionStatus } from "@/actions/subscription"

export type AccessStatus = {
    hasAccess: boolean
    reason: 'admin_override' | 'trial_active' | 'subscription_active' | 'expired'
    daysRemaining?: number
}

// Cache trial period to avoid repeated calls
let cachedTrialDays: number | null = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 minute

async function getCachedTrialPeriod(): Promise<number> {
    const now = Date.now()
    if (cachedTrialDays !== null && (now - cacheTime) < CACHE_TTL) {
        return cachedTrialDays
    }
    cachedTrialDays = await getTrialPeriod().catch(() => 14)
    cacheTime = now
    return cachedTrialDays
}

// Client-side check (fast, for UI)
// Note: Real security should be RLS/Middleware, but UI needs to show/hide stuff.
export async function checkAkaunAccess(user: any, role: string): Promise<AccessStatus> {
    // Admins and staff always have access - fastest path
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override' }
    }

    const supabase = createClient()

    // For organizers: check accounting_status first (db source of truth)
    if (role === 'organizer') {
        const { data: organizer } = await supabase
            .from('organizers')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .maybeSingle()
        
        // If accounting is active, grant access immediately
        if (organizer?.accounting_status === 'active') {
            return { hasAccess: true, reason: 'subscription_active' }
        }
    }

    // Calculate trial days - ALWAYS fetch fresh created_at from profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()
    
    const trialDays = await getCachedTrialPeriod()
    
    // Use fresh created_at from database, not stale user.created_at
    const createdAt = new Date(profile?.created_at || user.created_at).getTime()
    const now = Date.now()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    // Trial expired - check subscription
    if (role === 'tenant' || role === 'organizer') {
        const table = role === 'tenant' ? 'tenants' : 'organizers'
        
        const { data: entity } = await supabase
            .from(table)
            .select('id')
            .eq('profile_id', user.id)
            .maybeSingle()

        if (entity?.id) {
            const hasSub = await checkSubscriptionStatus(entity.id)
            if (hasSub) return { hasAccess: true, reason: 'subscription_active' }
        }
    }

    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}
