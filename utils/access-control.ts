import { createClient } from "@/utils/supabase/client"
import { getTrialPeriod } from "@/actions/settings"

export type AccessStatus = {
    hasAccess: boolean
    reason: 'admin_override' | 'trial_active' | 'subscription_active' | 'expired'
    daysRemaining?: number
}

// Client-side check (fast, for UI)
// Note: Real security should be RLS/Middleware, but UI needs to show/hide stuff.
export async function checkAkaunAccess(user: any, role: string): Promise<AccessStatus> {
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override' }
    }

    // Default trial period if not fetched (should ideally fetch from specific API or passed prop)
    // We'll fetch it from server action for now.
    const trialDays = await getTrialPeriod().catch(() => 14)

    const createdAt = new Date(user.created_at).getTime()
    const now = new Date().getTime()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    // Check Subscription (Placeholder - assume checking 'subscriptions' table)
    // For now, if trial expired, denied.
    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}
