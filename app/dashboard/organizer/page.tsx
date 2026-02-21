import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle, ArrowRight, Building, CreditCard, DollarSign } from "lucide-react"
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

    // Fetch data
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

    const { tenants, overdueTenants, userProfile, organizers, transactions } = dashboardData

    const totalTenants = tenants?.length || 0
    const totalLocations = locations?.length || 0
    const totalOverdue = overdueTenants?.length || 0
    
    // Calculate total income from completed transactions
    const totalIncome = transactions
        ?.filter((t: any) => t.type === 'income' && t.status === 'completed')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0

    const displayName = userProfile?.full_name || organizers?.[0]?.name || 'Penganjur'
    const organizerCode = userProfile?.organizer_code || organizers?.[0]?.organizer_code

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Hai, <span className="text-primary italic">{displayName}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Selamat datang ke papan pemuka penganjur anda.
                    </p>
                    {organizerCode && (
                        <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                            <span className="text-xs text-muted-foreground">Kod Penganjur Anda:</span>
                            <code className="text-sm font-bold text-primary font-mono">{organizerCode}</code>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Tenants Card */}
                <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20 rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary-foreground/80 font-medium text-xs uppercase tracking-wider">Jumlah Peniaga</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold">
                            {totalTenants}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/tenants">
                            <Button variant="secondary" size="sm" className="rounded-full text-xs font-bold px-4">
                                Lihat Peniaga <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Locations Card */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Lokasi Tapak</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-foreground">
                            {totalLocations}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations">
                            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4">
                                Urus Lokasi <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Total Income Card */}
                <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-700 font-medium text-xs uppercase tracking-wider">Jumlah Kutipan</CardDescription>
                        <CardTitle className="text-3xl font-sans font-bold text-emerald-800">
                            RM {totalIncome.toFixed(0)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/accounting">
                            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                                Lihat Akaun <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Overdue Card */}
                <Card className={`border-none shadow-sm rounded-[2rem] ${totalOverdue > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-border/50'}`}>
                    <CardHeader className="pb-2">
                        <CardDescription className={`font-medium text-xs uppercase tracking-wider ${totalOverdue > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Tunggakan</CardDescription>
                        <CardTitle className={`text-4xl font-sans font-bold ${totalOverdue > 0 ? 'text-red-800' : 'text-foreground'}`}>
                            {totalOverdue}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-sm ${totalOverdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {totalOverdue > 0 ? `${totalOverdue} peniaga berhutang` : 'Tiada tunggakan'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                            <MapPin className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="font-serif text-xl">Lokasi</CardTitle>
                        <CardDescription>Urus tapak pasar dan gerai</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations">
                            <Button className="w-full rounded-xl">
                                Urus Lokasi <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="font-serif text-xl">Peniaga</CardTitle>
                        <CardDescription>Senarai dan urus peniaga</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/tenants">
                            <Button className="w-full rounded-xl">
                                Lihat Peniaga <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                            <CreditCard className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="font-serif text-xl">Akaun</CardTitle>
                        <CardDescription>Rekod kewangan & 7 Tabung</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/accounting">
                            <Button className="w-full rounded-xl">
                                Buka Akaun <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue Alert */}
            {totalOverdue > 0 && (
                <Card className="border-red-200 bg-red-50/50 rounded-[2rem]">
                    <CardHeader>
                        <CardTitle className="text-red-800 flex items-center gap-2 font-serif text-xl">
                            <AlertCircle className="w-5 h-5" />
                            Peniaga Berhutang
                        </CardTitle>
                        <CardDescription className="text-red-600">
                            {totalOverdue} peniaga mempunyai tunggakan sewa
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {overdueTenants.slice(0, 3).map((tenant: any) => (
                                <div key={tenant.id} className="flex items-center justify-between p-3 bg-white rounded-xl">
                                    <div>
                                        <p className="font-medium">{tenant.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{tenant.locationName} • {tenant.overdueText}</p>
                                    </div>
                                    <p className="font-bold text-red-600">RM {tenant.arrears}</p>
                                </div>
                            ))}
                        </div>
                        {overdueTenants.length > 3 && (
                            <Button asChild variant="outline" className="w-full mt-4 rounded-xl">
                                <Link href="/dashboard/tenants">Lihat Semua</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
