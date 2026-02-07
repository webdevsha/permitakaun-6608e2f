import { fetchDashboardData } from "@/utils/data/dashboard"
import { Users, Building, Shield, CreditCard, ArrowRight, MapPin, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        redirect('/login')
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .single()
    
    const role = determineUserRole(profile, user.email)
    
    if (!['admin', 'superadmin', 'staff'].includes(role)) {
        if (role === 'organizer') {
            redirect('/dashboard/organizer')
        } else {
            redirect('/dashboard/tenant')
        }
    }

    // Fetch data
    let data: any
    try {
        data = await fetchDashboardData()
    } catch (e) {
        console.error('[Admin] Error fetching dashboard data:', e)
        data = { tenants: [], organizers: [], transactions: [], user: user, role: role }
    }

    const { tenants, organizers, transactions } = data

    // Calculate metrics
    const totalTenants = tenants?.length || 0
    const totalOrganizers = organizers?.length || 0
    
    const displayName = profile?.full_name || (role === 'staff' ? 'Staf' : 'Admin')
    const displayTitle = role === 'staff' ? 'Dashboard Staf' : 'Admin Dashboard'

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Hai, <span className="text-primary italic">{displayName}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        {role === 'staff' ? 'Akses Staf ke sistem' : 'Pentadbiran Sistem Permit Akaun'}
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

                {/* Total Organizers Card */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Jumlah Penganjur</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-foreground">
                            {totalOrganizers}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/organizers">
                            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4">
                                Lihat Penganjur <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Accounting Card */}
                <Card className="bg-emerald-50 border-emerald-100 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-700 font-medium text-xs uppercase tracking-wider">Akaun Sistem</CardDescription>
                        <CardTitle className="text-2xl font-sans font-bold text-emerald-800">
                            Akaun
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/accounting">
                            <Button variant="outline" size="sm" className="rounded-full text-xs font-bold px-4 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                                Buka Akaun <ArrowRight className="ml-2 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Role Card */}
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Peranan</CardDescription>
                        <CardTitle className="text-2xl font-sans font-bold text-foreground capitalize">
                            {role === 'superadmin' ? 'Super Admin' : role}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground">
                            {role === 'staff' ? 'Akses terhad' : 'Akses penuh'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <Building className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle className="font-serif text-xl">Penganjur</CardTitle>
                        <CardDescription>Senarai penganjur aktif</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/organizers">
                            <Button className="w-full rounded-xl">
                                Lihat Penganjur <ArrowRight className="ml-2 w-4 h-4" />
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

            {/* Admin-only Actions */}
            {role !== 'staff' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                        <CardHeader>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-2">
                                <Shield className="w-6 h-6 text-purple-600" />
                            </div>
                            <CardTitle className="font-serif text-xl">Pengurusan Staf</CardTitle>
                            <CardDescription>Tambah dan urus staf</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/staff">
                                <Button variant="outline" className="w-full rounded-xl">
                                    Urus Staf <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                        <CardHeader>
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-2">
                                <Settings className="w-6 h-6 text-slate-600" />
                            </div>
                            <CardTitle className="font-serif text-xl">Tetapan</CardTitle>
                            <CardDescription>Konfigurasi sistem</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/dashboard/settings">
                                <Button variant="outline" className="w-full rounded-xl">
                                    Buka Tetapan <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
