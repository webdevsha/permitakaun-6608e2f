import { createClient } from "@/utils/supabase/server"
import DashboardLayoutClient from "@/components/dashboard-layout-client"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Dashboard Layout - Server Component
 * 
 * Fetches user data server-side to prevent client-side flickering.
 * All role-based decisions are made here before rendering.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    // Fetch User and Profile in parallel for better performance
    const [{ data: { user } }, { data: profile }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
            .from("profiles")
            .select("*")
            .single()
    ])

    if (!user) {
        redirect("/login")
    }

    // Determine Role using consistent shared utility
    const userRole = determineUserRole(profile, user.email)

    // Pass data to client component for hydration
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
