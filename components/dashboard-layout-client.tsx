"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar, MobileNav } from "@/components/app-sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"

import { User } from "@supabase/supabase-js"
import { Profile } from "@/types/supabase-types"

interface DashboardLayoutProps {
    children: React.ReactNode
    initialUser: User | null
    initialRole: string | null
    initialProfile: Profile | null
}

export default function DashboardLayoutClient({
    children,
    initialUser,
    initialRole,
    initialProfile
}: DashboardLayoutProps) {
    const { role: authRole, signOut, user: authUser, profile: authProfile, isLoading, isInitialized } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const checkedRef = useRef(false)
    const [isSigningOut, setIsSigningOut] = useState(false)

    // CRITICAL: Use server-provided initial data as source of truth to prevent flickering
    // Only fall back to auth context if initial data is not available
    const user = initialUser || authUser
    const role = initialRole || authRole
    const profile = initialProfile || authProfile

    // Check subscription access for Akaun
    useEffect(() => {
        // Only check access once after auth is initialized
        if (!isInitialized || checkedRef.current) return
        checkedRef.current = true

        const verifyAccess = async () => {
            if (!user) {
                window.location.href = '/login'
                return
            }

            // Skip subscription check for certain paths
            if (pathname.includes('/dashboard/subscription') || pathname.includes('/dashboard/settings')) return

            // ONLY enforce subscription for Accounting features
            if (!pathname.startsWith('/dashboard/accounting')) return

            // Admin/Staff/Superadmin - always allow
            if (role === 'admin' || role === 'staff' || role === 'superadmin') {
                console.log('[Layout] Admin/Staff/Superadmin - allowing access')
                return
            }

            // For organizers and tenants - let the Accounting module handle the check
            // Don't redirect here, let the module show appropriate UI
            console.log('[Layout] Organizer/Tenant - letting module handle access check')
        }

        verifyAccess()
    }, [user, role, pathname, router, isInitialized])

    // Show loading state only during initial hydration
    if (isLoading && !isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-secondary">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    return (
        <div className="min-h-screen flex w-full bg-secondary">
            <AppSidebar
                isCollapsed={false}
                setIsCollapsed={() => { }}
                initialUser={initialUser}
                initialRole={initialRole}
                initialProfile={initialProfile}
            />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
