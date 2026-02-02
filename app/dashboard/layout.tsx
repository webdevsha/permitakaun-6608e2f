import { createClient } from "@/utils/supabase/server"
import DashboardLayoutClient from "@/components/dashboard-layout-client"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    // 1. Fetch Session
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect("/")
    }

    // 2. Fetch Profile (Parallel to session check not possible, need user ID)
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

    // 3. Determine Role using shared utility
    const userRole = determineUserRole(profile, session.user.email)

    // 4. Pass data to client component
    return (
        <DashboardLayoutClient
            initialUser={session.user}
            initialRole={userRole}
            initialProfile={profile}
        >
            {children}
        </DashboardLayoutClient>
    )
}
