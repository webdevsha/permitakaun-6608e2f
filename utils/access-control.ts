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

    // Calculate trial days in parallel with other operations
    const trialDaysPromise = getCachedTrialPeriod()
    
    const createdAt = new Date(user.created_at).getTime()
    const now = Date.now()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    
    const trialDays = await trialDaysPromise
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    // Trial expired - check subscription (only for tenant/organizer)
    if (role === 'tenant' || role === 'organizer') {
        const supabase = createClient()
        const table = role === 'tenant' ? 'tenants' : 'organizers'
        
        const { data: entity } = await supabase
            .from(table)
            .select('id')
            .eq('profile_id', user.id)
            .maybeSingle() // Use maybeSingle instead of single to avoid errors

        if (entity?.id) {
            const hasSub = await checkSubscriptionStatus(entity.id)
            if (hasSub) return { hasAccess: true, reason: 'subscription_active' }
        }
    }

    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}
