import { createClient } from "@/utils/supabase/client"
import { getTrialPeriod } from "@/actions/settings"
import { checkSubscriptionStatus } from "@/actions/subscription"

export type AccessStatus = {
    hasAccess: boolean
    reason: 'admin_override' | 'trial_active' | 'subscription_active' | 'expired'
    daysRemaining?: number
}

// Client-side check (fast, for UI)
// Note: Real security should be RLS/Middleware, but UI needs to show/hide stuff.
export async function checkAkaunAccess(user: any, role: string): Promise<AccessStatus> {
    // Admins and staff always have access
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override' }
    }

    // Get trial period
    const trialDays = await getTrialPeriod().catch(() => 14)

    const createdAt = new Date(user.created_at).getTime()
    const now = new Date().getTime()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    // Check subscription based on role
    const supabase = createClient()

    if (role === 'tenant') {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('profile_id', user.id)
            .single()

        if (tenant) {
            const hasSub = await checkSubscriptionStatus(tenant.id)
            if (hasSub) return { hasAccess: true, reason: 'subscription_active' }
        }
    } else if (role === 'organizer') {
        const { data: organizer } = await supabase
            .from('organizers')
            .select('id')
            .eq('profile_id', user.id)
            .single()

        if (organizer) {
            const hasSub = await checkSubscriptionStatus(organizer.id)
            if (hasSub) return { hasAccess: true, reason: 'subscription_active' }
        }
    }

    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}
