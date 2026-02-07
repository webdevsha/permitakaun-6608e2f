import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

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

    // Fetch data with individual error handling
    let dashboardData: any = { 
        tenants: [], 
        overdueTenants: [], 
        userProfile: profile, 
        organizers: [], 
        myLocations: [], 
        availableLocations: [], 
        transactions: [], 
        role: role || 'organizer' 
    }
    let locations: any[] = []

    try {
        dashboardData = await fetchDashboardData()
    } catch (e) {
        console.error('[OrganizerDashboard] Error fetching dashboard data:', e)
    }

    try {
        locations = await fetchLocations()
    } catch (e) {
        console.error('[OrganizerDashboard] Error fetching locations:', e)
        locations = []
    }

    const { tenants, overdueTenants, userProfile, organizers } = dashboardData

    const totalTenants = tenants?.length || 0
    const totalLocations = locations?.length || 0
    const totalOverdue = overdueTenants?.length || 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold font-serif">Dashboard Penganjur</h1>
                <p className="text-muted-foreground">
                    {userProfile?.business_name || userProfile?.full_name || organizers?.[0]?.name || 'Penganjur'}
                </p>
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
    )
}
