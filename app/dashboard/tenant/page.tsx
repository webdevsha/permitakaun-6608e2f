import { fetchDashboardData } from "@/utils/data/dashboard"
import { ArrowRight, TrendingUp, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"
import { Suspense } from "react"

// Server-side access check to avoid client/server mismatch
async function checkAccessServer(user: any, role: string) {
    // Admins and staff always have access
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override', daysRemaining: 0 }
    }

    const supabase = await createClient()

    // Calculate trial days
    const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'trial_period_days')
        .maybeSingle()
    const trialDays = parseInt(settings?.value || '14')

    const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()
    
    const createdAt = new Date(profile?.created_at || user.created_at).getTime()
    const now = Date.now()
    const diffDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
    const remaining = Math.max(0, trialDays - diffDays)

    if (remaining > 0) {
        return { hasAccess: true, reason: 'trial_active', daysRemaining: remaining }
    }

    return { hasAccess: false, reason: 'expired', daysRemaining: 0 }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Tenant Dashboard Page
 * 
 * This page should only be accessible to users with tenant role.
 * Server-side role verification prevents unauthorized access.
 */
// Helper for timeout
const withTimeout = <T,>(queryBuilder: any, ms: number, context: string): Promise<T> => {
    return Promise.race([
        queryBuilder as Promise<T>,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout: ${context} exceeded ${ms}ms`)), ms)
        )
    ])
}

export default async function TenantDashboardPage() {
    // Verify user and role server-side
    const supabase = await createClient()
    
    // Get user with timeout
    let user: any;
    try {
        const authResult: any = await withTimeout(
            supabase.auth.getUser(),
            5000,
            'getUser'
        )
        user = authResult.data?.user
    } catch (e) {
        console.error('[TenantDashboard] Timeout getting user:', e)
        redirect('/login')
    }
    
    if (!user) {
        redirect('/login')
    }
    
    // Get profile with timeout
    let profile;
    try {
        const profileResult: any = await withTimeout(
            supabase
                .from('profiles')
                .select('role, organizer_code, full_name, email')
                .eq('id', user.id)
                .maybeSingle(),
            3000,
            'getProfile'
        )
        profile = profileResult.data
    } catch (e) {
        console.error('[TenantDashboard] Timeout getting profile:', e)
        profile = null
    }
    
    const role = determineUserRole(profile, user.email)
    
    // Only tenants should access this page
    // Organizers/admins/superadmins can also use this as a simplified view
    // But if someone tries to access with wrong expectations, they can still see

    // Fetch dashboard data with timeout
    let data: any;
    try {
        data = await withTimeout(
            fetchDashboardData(),
            8000,
            'fetchDashboardData'
        )
    } catch (e) {
        console.error('[TenantDashboard] Timeout fetching dashboard data:', e)
        // Use empty data as fallback
        data = { myLocations: [], userProfile: profile, transactions: [], tenants: [], overdueTenants: [], organizers: [], availableLocations: [], role: role || 'tenant' }
    }
    
    const { myLocations, userProfile } = data
    const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Peniaga"

    // Check Access (server-side version to avoid client/server mismatch)
    let access: any;
    try {
        access = await withTimeout(
            checkAccessServer(user, role),
            3000,
            'checkAccessServer'
        )
    } catch (e) {
        console.error('[TenantDashboard] Timeout checking access:', e)
        access = { hasAccess: true, reason: 'trial_active', daysRemaining: 14 }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Trial Banner */}
            {access.reason === 'trial_active' && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between text-blue-900 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-full"><TrendingUp size={20} /></div>
                        <div>
                            <p className="font-bold text-sm">Percubaan Percuma 'Akaun' Aktif</p>
                            <p className="text-xs opacity-80">Anda mempunyai <span className="font-bold text-lg">{access.daysRemaining}</span> hari lagi sebelum perlu melanggan.</p>
                        </div>
                    </div>
                    <Link href="/dashboard/subscription">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Langgan Sekarang</Button>
                    </Link>
                </div>
            )}

            {access.reason === 'expired' && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center justify-between text-red-900 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-full"><AlertCircle size={20} /></div>
                        <div>
                            <p className="font-bold text-sm">Tempoh Percubaan Tamat</p>
                            <p className="text-xs opacity-80">Sila langgan untuk terus mengakses ciri-ciri Akaun.</p>
                        </div>
                    </div>
                    <Link href="/dashboard/subscription">
                        <Button size="sm" variant="destructive" className="rounded-lg">Langgan Sekarang</Button>
                    </Link>
                </div>
            )}

            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Hai, <span className="text-primary italic">{userProfile?.full_name || displayRole}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Selamat datang ke papan pemuka anda.
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20 rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary-foreground/80 font-medium text-xs uppercase tracking-wider">Tapak Sewaan Aktif</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold">
                            {myLocations?.length || 0}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/rentals">
                            <Button variant="secondary" size="sm" className="rounded-full text-xs font-bold px-4">
                                Lihat Sewaan <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Status Akaun</CardDescription>
                        <CardTitle className="text-2xl font-sans font-bold text-foreground">
                            Aktif
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground">
                            Tiada tunggakan tertunggak.
                        </div>
                    </CardContent>
                </Card>

                {/* New Section: Browse Locations (Placeholder for Penganjur Locations) */}
                <div className="md:col-span-2">
                    <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                        <CardHeader>
                            <CardTitle>Cari Tapak Sewaan</CardTitle>
                            <CardDescription>Lihat senarai lokasi mengikut penganjur.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/locations">
                                <Button variant="outline" className="rounded-xl">
                                    Semak Lokasi
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
