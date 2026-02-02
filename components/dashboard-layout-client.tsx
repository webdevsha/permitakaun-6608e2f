"use client"

import { useState, useEffect } from "react"
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
    const { user, role, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    // Use passed initial data if AuthProvider is still loading
    const currentUser = user || initialUser
    const currentRole = role || initialRole

    useEffect(() => {
        const verifyAccess = async () => {
            // Use currentUser/currentRole instead of waiting for loading
            if (!currentUser) return
            if (pathname.includes('/dashboard/subscription') || pathname.includes('/dashboard/settings')) return

            // ONLY enforce subscription for Accounting features
            if (!pathname.startsWith('/dashboard/accounting')) return

            // Admin Override (Double safety)
            if (currentRole === 'admin' || currentRole === 'staff' || currentRole === 'superadmin') return

            const { hasAccess, reason } = await checkAkaunAccess(currentUser, currentRole || 'tenant')

            if (!hasAccess && reason === 'expired') {
                toast.error("Tempoh percubaan anda telah tamat. Sila langgan untuk meneruskan akses.", {
                    duration: 5000,
                    id: 'expired-toast' // prevent duplicate toasts
                })
                router.push('/dashboard/subscription')
            }
        }

        verifyAccess()
    }, [currentUser, currentRole, pathname, router])

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
