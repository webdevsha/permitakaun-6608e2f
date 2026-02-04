"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar, MobileNav } from "@/components/app-sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { checkAkaunAccess } from "@/utils/access-control"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"

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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const { user: authUser, role: authRole, isLoading, isInitialized } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    
    // Prevent duplicate access checks
    const checkedRef = useRef(false)

    // Use server-provided initial data as the source of truth
    // This prevents flickering during client hydration
    const currentUser = initialUser || authUser
    const currentRole = initialRole || authRole

    useEffect(() => {
        // Only check access once after auth is initialized
        if (!isInitialized || checkedRef.current) return
        checkedRef.current = true

        const verifyAccess = async () => {
            if (!currentUser) {
                router.push('/login')
                return
            }

            // Skip subscription check for certain paths
            if (pathname.includes('/dashboard/subscription') || pathname.includes('/dashboard/settings')) return

            // ONLY enforce subscription for Accounting features
            if (!pathname.startsWith('/dashboard/accounting')) return

            // Admin Override (Double safety)
            if (currentRole === 'admin' || currentRole === 'staff' || currentRole === 'superadmin') return

            try {
                const { hasAccess, reason } = await checkAkaunAccess(currentUser, currentRole || 'tenant')

                if (!hasAccess && reason === 'expired') {
                    toast.error("Tempoh percubaan anda telah tamat. Sila langgan untuk meneruskan akses.", {
                        duration: 5000,
                        id: 'expired-toast' // prevent duplicate toasts
                    })
                    router.push('/dashboard/subscription')
                }
            } catch (error) {
                console.error('Access verification error:', error)
            }
        }

        verifyAccess()
    }, [currentUser, currentRole, pathname, router, isInitialized])

    // Show loading state only during initial hydration
    // Use server data to prevent layout shift
    if (!currentUser) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Memuatkan...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-background font-sans overflow-hidden">
            <AppSidebar
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                initialRole={initialRole}
                initialUser={initialUser}
                initialProfile={initialProfile}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                <MobileNav
                    initialRole={initialRole}
                    initialUser={initialUser}
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-10 pb-20">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
