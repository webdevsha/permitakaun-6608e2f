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

    console.log('[Layout] Render:', { 
        isLoading, 
        isInitialized, 
        hasInitialUser: !!initialUser, 
        hasAuthUser: !!authUser,
        hasEffectiveUser: !!user
    })

    // Check subscription access for Akaun
    useEffect(() => {
        console.log('[Layout] useEffect triggered:', { isInitialized, checked: checkedRef.current })
        
        if (!isInitialized || checkedRef.current) return
        checkedRef.current = true

        const verifyAccess = async () => {
            console.log('[Layout] Verifying access, user:', !!user)
            
            if (!user) {
                console.log('[Layout] No user, redirecting to login')
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

            console.log('[Layout] Organizer/Tenant - letting module handle access check')
        }

        verifyAccess()
    }, [user, role, pathname, router, isInitialized])

    // Show loading state only during initial hydration  
    // CRITICAL FIX: If server provided initialUser, don't show loading spinner
    // because we already have valid data from the server
    const effectiveUser = initialUser || authUser
    
    // Show spinner only if:
    // 1. Auth is still loading AND not initialized AND no user from either server or client
    if (isLoading && !isInitialized && !effectiveUser) {
        console.log('[Layout] Showing loading spinner')
        return (
            <div className="min-h-screen flex items-center justify-center bg-secondary">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    // Return null if no user at all (will redirect in useEffect or let error boundary handle)
    if (!user) {
        console.log('[Layout] No user, returning null')
        return null
    }

    console.log('[Layout] Rendering dashboard layout')
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
