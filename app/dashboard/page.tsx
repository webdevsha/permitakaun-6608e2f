import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

/**
 * Dashboard entry point - performs role-based routing
 * This page redirects immediately without fetching data to avoid timeouts
 */
export default async function DashboardPage() {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        redirect('/login')
    }
    
    // Get just the role - no heavy data fetching
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single()
    
    const role = determineUserRole(profile, user.email)

    // Immediate redirect based on role
    if (role === 'organizer') {
        redirect('/dashboard/organizer')
    }

    if (role === 'tenant') {
        redirect('/dashboard/tenant')
    }

    if (role === 'admin' || role === 'staff' || role === 'superadmin') {
        redirect('/admin')
    }

    // Fallback
    redirect('/login')
}
