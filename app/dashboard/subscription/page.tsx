import { SubscriptionPlans } from "@/components/subscription-plans"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Server-side access check to avoid client/server mismatch
async function checkAccessServer(user: any, role: string) {
    // Admins and staff always have access
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override', daysRemaining: 0 }
    }

    const supabase = await createClient()

    // For organizers: check accounting_status first
    if (role === 'organizer') {
        const { data: organizer } = await supabase
            .from('organizers')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .maybeSingle()

        if (organizer?.accounting_status === 'active') {
            return { hasAccess: true, reason: 'subscription_active', daysRemaining: 0 }
        }
    } else if (role === 'tenant') {
        const { data: tenant } = await supabase
            .from('tenants')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .maybeSingle()

        if (tenant?.accounting_status === 'active') {
            return { hasAccess: true, reason: 'subscription_active', daysRemaining: 0 }
        }
    }

    // Calculate trial days
    const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'trial_period_days')
        .maybeSingle()
    const trialDays = parseInt(settings?.value || '14')

    const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()

    const createdAt = new Date(profile?.created_at || user.created_at).getTime()
    const now = Date.now()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SubscriptionPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return (
            <div className="container mx-auto py-10">
                <SubscriptionPlans />
            </div>
        )
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .eq('id', user.id)
        .single()

    const role = determineUserRole(profile, user.email)

    // Check access status (server-side version)
    const access = await checkAccessServer(user, role)

    const isExpired = access.reason === 'expired'

    return (
        <div className="container mx-auto py-10 space-y-6">
            {/* Trial Expired Warning */}
            {isExpired && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <AlertTitle className="text-red-800 font-bold">Tempoh Percubaan Tamat</AlertTitle>
                    <AlertDescription className="text-red-700">
                        Tempoh percubaan anda telah tamat. Sila langgan untuk terus mengakses ciri-ciri Akaun.
                    </AlertDescription>
                </Alert>
            )}

            <SubscriptionPlans />
        </div>
    )
}
