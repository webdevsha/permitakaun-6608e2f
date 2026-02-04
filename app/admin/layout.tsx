import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"
import DashboardLayoutClient from "@/components/dashboard-layout-client"

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Admin Layout - Server Component
 * 
 * This layout is used for admin pages (/admin/*).
 * It ensures only admins can access these routes.
 */
export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/login")
    }

    // Fetch profile and determine role
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

    const userRole = determineUserRole(profile, user.email)

    // Restrict access to admin roles only
    if (!['admin', 'superadmin', 'staff'].includes(userRole)) {
        // Non-admin users should be redirected to their respective dashboards
        if (userRole === 'organizer') {
            redirect('/dashboard/organizer')
        } else {
            redirect('/dashboard/tenant')
        }
    }

    return (
        <DashboardLayoutClient
            initialUser={user}
            initialRole={userRole}
            initialProfile={profile}
        >
            {children}
        </DashboardLayoutClient>
    )
}
