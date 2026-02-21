import { fetchDashboardData } from "@/utils/data/dashboard"
import { TenantListEnhanced } from "@/components/tenant-list-enhanced"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { determineUserRole } from "@/utils/roles"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TenantsPage() {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Get user profile and role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .eq('id', user.id)
        .maybeSingle()

    const role = determineUserRole(profile, user.email)

    // Get organizer ID if user is an organizer
    let organizerId: string | undefined
    if (role === 'organizer') {
        const { data: orgData } = await supabase
            .from('organizers')
            .select('id')
            .eq('profile_id', user.id)
            .single()
        organizerId = orgData?.id
    }

    // Fetch dashboard data which includes tenants
    const data = await fetchDashboardData()

    return (
        <TenantListEnhanced 
            initialTenants={data.tenants}
            organizerId={organizerId}
            isAdmin={role === 'admin' || role === 'superadmin'}
        />
    )
}
