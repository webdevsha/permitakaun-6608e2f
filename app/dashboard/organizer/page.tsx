import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle, ArrowRight, Calendar, FileText, DollarSign } from "lucide-react"
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

    const { tenants, overdueTenants, userProfile, organizers, transactions } = dashboardData

    const totalTenants = tenants?.length || 0
    const totalLocations = locations?.length || 0
    const totalOverdue = overdueTenants?.length || 0
    
    // Calculate total income from transactions
    const totalIncome = transactions
        ?.filter((t: any) => t.type === 'income' && t.status === 'completed')
        .reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0
    
    // Get recent transactions (last 5)
    const recentTransactions = transactions
        ?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5) || []
    
    const displayName = userProfile?.business_name || userProfile?.full_name || organizers?.[0]?.name || 'Penganjur'

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Hai, <span className="text-primary italic">{displayName}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Dashboard Penganjur Permit Akaun
                    </p>
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

                {/* Total Locations Card */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Lokasi</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-foreground">
                            {totalLocations}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations">
                            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4">
                                Lihat Lokasi <ArrowRight className="ml-2 w-3 h-3" />
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

                {/* Total Overdue Card */}
                <Card className={`${totalOverdue > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-border/50'} shadow-sm rounded-[2rem]`}>
                    <CardHeader className="pb-2">
                        <CardDescription className={`font-medium text-xs uppercase tracking-wider ${totalOverdue > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Tunggakan</CardDescription>
                        <CardTitle className={`text-4xl font-sans font-bold ${totalOverdue > 0 ? 'text-red-800' : 'text-foreground'}`}>
                            {totalOverdue}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-sm ${totalOverdue > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {totalOverdue > 0 ? 'Peniaga berhutang' : 'Tiada tunggakan'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue Tenants Alert */}
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
                            {overdueTenants.slice(0, 5).map((tenant: any) => (
                                <div key={tenant.id} className="flex items-center justify-between p-3 bg-white rounded-xl">
                                    <div>
                                        <p className="font-medium">{tenant.full_name}</p>
                                        <p className="text-sm text-muted-foreground">{tenant.locationName} • {tenant.overdueText}</p>
                                    </div>
                                    <p className="font-bold text-red-600">RM {tenant.arrears}</p>
                                </div>
                            ))}
                        </div>
                        {overdueTenants.length > 5 && (
                            <Button asChild variant="outline" className="w-full mt-4 rounded-xl">
                                <Link href="/dashboard/tenants">Lihat Semua</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem] hover:shadow-md transition-shadow">
                    <CardHeader>
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
                            <MapPin className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="font-serif text-xl">Lokasi</CardTitle>
                        <CardDescription>Urus lokasi pasar</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations">
                            <Button className="w-full rounded-xl">
                                Lihat Lokasi <ArrowRight className="ml-2 w-4 h-4" />
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
                        <CardDescription>Senarai peniaga aktif</CardDescription>
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
                            <TrendingUp className="w-6 h-6 text-primary" />
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

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="font-serif text-xl flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Transaksi Terkini
                            </CardTitle>
                            <CardDescription>5 transaksi terbaru</CardDescription>
                        </div>
                        <Link href="/dashboard/accounting">
                            <Button variant="outline" size="sm" className="rounded-xl">
                                Lihat Semua
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentTransactions.map((transaction: any) => (
                                <div key={transaction.id} className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${transaction.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                            {transaction.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-medium">{transaction.description}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(transaction.date).toLocaleDateString('ms-MY')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {transaction.type === 'income' ? '+' : '-'} RM {Number(transaction.amount).toFixed(2)}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${transaction.status === 'completed' || transaction.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {transaction.status === 'completed' || transaction.status === 'approved' ? 'Selesai' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
