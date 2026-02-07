import { createClient } from "@/utils/supabase/server"
import DashboardLayoutClient from "@/components/dashboard-layout-client"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper to add timeout to Supabase queries
async function withTimeout<T>(
    queryFn: () => any,
    ms: number,
    context: string
): Promise<T> {
    return Promise.race([
        Promise.resolve(queryFn()),
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${context} exceeded ${ms}ms`)), ms)
        )
    ])
}

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
    console.log('[DashboardLayout] Starting render')
    const supabase = await createClient()
    console.log('[DashboardLayout] Supabase client created')

    // Fetch User first (with timeout)
    let user: any;
    try {
        const authResult: any = await withTimeout(
            () => supabase.auth.getUser(),
            5000,
            'getUser'
        )
        user = authResult?.data?.user
    } catch (e) {
        console.error('[DashboardLayout] Timeout/error getting user:', e)
        redirect("/login")
    }

    if (!user) {
        console.log('[DashboardLayout] No user, redirecting to login')
        redirect("/login")
    }
    console.log('[DashboardLayout] User found:', user.email)

    // Fetch Profile with timeout and proper user filter
    let profile: any = null;
    try {
        const profileResult: any = await withTimeout(
            () => supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle(),
            3000,
            'getProfile'
        )
        profile = profileResult?.data
    } catch (e) {
        console.error('[DashboardLayout] Timeout/error getting profile:', e)
        // Continue without profile - determineUserRole will handle it
    }

    // Determine Role using consistent shared utility
    const userRole = determineUserRole(profile, user.email)
    console.log('[DashboardLayout] Role determined:', userRole)

    // Pass data to client component for hydration
    console.log('[DashboardLayout] Rendering layout client')
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
