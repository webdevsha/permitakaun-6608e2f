import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle, ArrowRight, Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"
import { Suspense } from "react"

// Loading fallback component
function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid gap-6 md:grid-cols-3">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="h-32 bg-gray-100">
                        <CardContent className="p-6">
                            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

// Server-side access check
async function checkAccessServer(user: any, role: string) {
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override', daysRemaining: 0 }
    }

    const supabase = await createClient()

    if (role === 'organizer') {
        const { data: organizer } = await supabase
            .from('organizers')
            .select('accounting_status')
            .eq('profile_id', user.id)
            .maybeSingle()
        
        if (organizer?.accounting_status === 'active') {
            return { hasAccess: true, reason: 'subscription_active', daysRemaining: 0 }
        }
    }

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

async function DashboardContent({ user, role, profile }: { user: any, role: string, profile: any }) {
    // Fetch data - this will stream
    let dashboardData: any, locations: any;
    try {
        [dashboardData, locations] = await Promise.all([
            fetchDashboardData(),
            fetchLocations()
        ])
    } catch (e) {
        console.error('[OrganizerDashboard] Error fetching data:', e)
        dashboardData = { 
            tenants: [], overdueTenants: [], userProfile: profile, 
            organizers: [], myLocations: [], availableLocations: [], 
            transactions: [], role: role || 'organizer' 
        }
        locations = []
    }

    const { tenants, overdueTenants, userProfile, organizers } = dashboardData
    
    let access;
    try {
        access = await checkAccessServer(user, role)
    } catch (e) {
        access = { hasAccess: true, reason: 'error_fallback', daysRemaining: 0 }
    }

    if (!access.hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
                <div className="text-center space-y-4 max-w-md">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-red-800">Akses Tamat</h2>
                    <p className="text-red-600">Tempoh percubaan anda telah tamat. Sila langgan untuk terus menggunakan sistem.</p>
                    <Button asChild className="mt-4">
                        <Link href="/dashboard/subscription">Langgan Sekarang</Link>
                    </Button>
                </div>
            </div>
        )
    }

    const totalTenants = tenants?.length || 0
    const totalLocations = locations?.length || 0
    const totalOverdue = overdueTenants?.length || 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {access.reason === 'trial_active' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 text-sm">
                    <strong>Tempoh Percubaan:</strong> {access.daysRemaining} hari lagi. 
                    <Link href="/dashboard/subscription" className="underline ml-2 font-medium">Langgan Sekarang</Link>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-serif">Dashboard Penganjur</h1>
                    <p className="text-muted-foreground">
                        {userProfile?.business_name || userProfile?.full_name || organizers?.[0]?.name || 'Penganjur'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/locations">
                            <MapPin className="w-4 h-4 mr-2" /> Lokasi
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/tenants">
                            <Users className="w-4 h-4 mr-2" /> Peniaga
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Jumlah Peniaga</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTenants}</div>
                        <p className="text-xs text-muted-foreground">Peniaga aktif</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lokasi</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalLocations}</div>
                        <p className="text-xs text-muted-foreground">Tapak pasar</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tunggakan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-red-600' : ''}`}>
                            {totalOverdue}
                        </div>
                        <p className="text-xs text-muted-foreground">Peniaga berhutang</p>
                    </CardContent>
                </Card>
            </div>

            {totalOverdue > 0 && (
                <Card className="border-red-200 bg-red-50/50">
                    <CardHeader>
                        <CardTitle className="text-red-800 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            Peniaga Berhutang
                        </CardTitle>
                        <CardDescription className="text-red-600">
                            {totalOverdue} peniaga mempunyai tunggakan sewa
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {overdueTenants.slice(0, 5).map((tenant: any) => (
                                <div key={tenant.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                    <div>
                                        <p className="font-medium">{tenant.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{tenant.locationName} • {tenant.overdueText}</p>
                                    </div>
                                    <p className="font-bold text-red-600">RM {tenant.arrears}</p>
                                </div>
                            ))}
                        </div>
                        {overdueTenants.length > 5 && (
                            <Button asChild variant="outline" className="w-full mt-4">
                                <Link href="/dashboard/tenants">Lihat Semua</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

export default async function OrganizerDashboardPage() {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        redirect('/login')
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .eq('id', user.id)
        .maybeSingle()
    
    const role = determineUserRole(profile, user.email)
    
    if (role === 'tenant') {
        redirect('/dashboard/tenant')
    }

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent user={user} role={role} profile={profile} />
        </Suspense>
    )
}
