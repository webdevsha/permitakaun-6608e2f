"use client"

import { useState, useEffect } from "react"
import { AppSidebar, MobileNav } from "@/components/app-sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { checkAkaunAccess } from "@/utils/access-control"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const { user, role, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const verifyAccess = async () => {
            // Skip check if loading, no user, or already on subscription page
            if (isLoading || !user) return
            if (pathname.includes('/dashboard/subscription') || pathname.includes('/dashboard/settings')) return

            const { hasAccess, reason } = await checkAkaunAccess(user, role || 'tenant')

            if (!hasAccess && reason === 'expired') {
                toast.error("Tempoh percubaan anda telah tamat. Sila langgan untuk meneruskan akses.", {
                    duration: 5000,
                    id: 'expired-toast' // prevent duplicate toasts
                })
                router.push('/dashboard/subscription')
            }
        }

        verifyAccess()
    }, [user, role, isLoading, pathname, router])

    return (
        <div className="flex h-screen bg-background font-sans overflow-hidden">
            <AppSidebar
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
            />
            <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
                <MobileNav />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth">
                    <div className="max-w-7xl mx-auto space-y-10 pb-20">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
