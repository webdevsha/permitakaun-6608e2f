import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle, ArrowRight, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

// Server-side access check to avoid client/server mismatch
async function checkAccessServer(user: any, role: string) {
    // Admins and staff always have access
    if (['admin', 'superadmin', 'staff'].includes(role)) {
        return { hasAccess: true, reason: 'admin_override', daysRemaining: 0 }
    }

    const supabase = await createClient()

    // For organizers: check accounting_status first
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
 * Organizer Dashboard Page
 * 
 * This page should only be accessible to users with organizer role.
 * Server-side role verification prevents unauthorized access.
 */
export default async function OrganizerDashboardPage() {
    // Verify user and role server-side
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        redirect('/login')
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, organizer_code, full_name, email')
        .eq('id', user.id)
        .single()
    
    const role = determineUserRole(profile, user.email)
    
    // Only organizers should access this page
    // Admins/superadmins can view but should primarily use /admin
    // Tenants should be redirected to their dashboard
    if (role === 'tenant') {
        redirect('/dashboard/tenant')
    }

    const dashboardData = await fetchDashboardData()
    const locations = await fetchLocations()

    const { tenants, overdueTenants, userProfile, organizers } = dashboardData

    // Check Access (server-side version to avoid client/server mismatch)
    const access = await checkAccessServer(user, role)

    // Filter Data for "My View" (Personalized Dashboard)
    // Even if Admin/Hybrid, show MY stats on dashboard to avoid clutter
    const myOrg = organizers.find((o: any) => o.profile_id === user?.id)
    const myOrgId = myOrg?.id
    const myOrgCode = myOrg?.organizer_code

    // If I have an organizer profile, filter. Otherwise show all (e.g. Superadmin)
    const displayLocations = myOrgId ? locations.filter((l: any) => l.organizer_id === myOrgId) : locations

    // For tenants, using organizer_code
    const displayTenants = myOrgCode ? tenants.filter((t: any) => t.organizer_code === myOrgCode) : tenants
    const displayOverdue = myOrgCode ? overdueTenants.filter((t: any) => t.organizer_code === myOrgCode) : overdueTenants

    const displayRole = "Penganjur"
    const activeTenantsCount = displayTenants.filter((t: any) => t.status === 'active').length

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
                        Hai, <span className="text-primary italic">{userProfile?.full_name || "Penganjur"}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Selamat kembali ke papan pemuka anda.
                    </p>
                </div>
                <div className="hidden md:flex bg-white px-6 py-3 rounded-2xl text-primary font-bold border border-border/50 shadow-sm items-center gap-3 text-sm">
                    Organizer Mode: {dashboardData.organizers[0]?.organizer_code || 'N/A'}
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20 rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary-foreground/80 font-medium text-xs uppercase tracking-wider">Lokasi Seliaan</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold">
                            {displayLocations.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations/new">
                            <Button variant="secondary" size="sm" className="rounded-full text-xs font-bold px-4">
                                <Plus className="w-3 h-3 mr-2" /> Tambah Lokasi
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-medium text-xs uppercase tracking-wider">Peniaga Berdaftar</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-foreground">
                            {displayTenants.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full w-fit">
                            <Users size={14} />
                            <span>{activeTenantsCount} Aktif</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-100 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-orange-800/70 font-medium text-xs uppercase tracking-wider">Tunggakan Peniaga</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-orange-700">
                            {displayOverdue.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs text-orange-700/80 bg-orange-100/50 px-3 py-1 rounded-full w-fit">
                            <AlertCircle size={14} />
                            <span>RM {displayOverdue.reduce((acc: number, t: any) => acc + (t.arrears || 0), 0).toLocaleString()} Lewat</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Recent Locations List */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-serif font-semibold">Senarai Lokasi</h2>
                        <Link href="/dashboard/locations" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                            Lihat Semua <ArrowRight size={14} />
                        </Link>
                    </div>

                    {displayLocations.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {displayLocations.slice(0, 3).map((loc: any) => (
                                <Card key={loc.id} className="bg-white border-border/50 shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-lg">{loc.name}</h3>
                                            <p className="text-sm text-muted-foreground capitalize">{loc.type} • {loc.tenant_count || 0} Peniaga</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-primary">RM {loc.rate_monthly || loc.rate_khemah || loc.rate_cbs}</p>
                                            <p className="text-xs text-muted-foreground">/ {loc.type === 'monthly' ? 'Bulan' : 'Minggu'}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-3xl border border-dashed border-border text-center">
                            <p className="text-muted-foreground text-sm">Tiada lokasi didaftarkan.</p>
                            <Button variant="link" className="text-primary">Tambah Lokasi Pertama</Button>
                        </div>
                    )}
                </div>

                {/* Tenants List Preview */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-serif font-semibold">Peniaga Terkini</h2>
                        <Link href="/dashboard/tenants" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                            Lihat Semua <ArrowRight size={14} />
                        </Link>
                    </div>

                    {displayTenants.length > 0 ? (
                        <div className="space-y-4">
                            {displayTenants.slice(0, 4).map((t: any) => (
                                <div key={t.id} className="bg-white p-4 rounded-2xl border border-border/40 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
                                            {t.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{t.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{t.business_name || 'Tiada Nama Perniagaan'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {t.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-3xl border border-dashed border-border text-center">
                            <p className="text-muted-foreground text-sm">Tiada peniaga berdaftar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* TRANSACTIONS SECTION */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-serif font-semibold">Senarai Transaksi Terkini</h2>
                    <Link href="/dashboard/accounting" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                        Lihat Semua <ArrowRight size={14} />
                    </Link>
                </div>

                {dashboardData.transactions && dashboardData.transactions.length > 0 ? (
                    <div className="bg-white border border-border/50 rounded-[2rem] shadow-sm overflow-hidden">
                        <div className="p-0">
                            <div className="grid grid-cols-1 divide-y divide-border/30">
                                {dashboardData.transactions.slice(0, 5).map((tx: any) => {
                                    // Logic for Organizer View:
                                    // Tenant's 'expense' for 'Sewa' is Organizer's INCOME.
                                    const isRentPayment = tx.type === 'expense' && (tx.category === 'Sewa' || tx.description?.toLowerCase().includes('sewa'));
                                    const displayType = isRentPayment ? 'income' : tx.type;

                                    return (
                                        <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${displayType === 'income' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {displayType === 'income' ? <TrendingUp size={18} /> : <AlertCircle size={18} />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm tracking-tight">{tx.description || "Bayaran"}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })} • {tx.tenants?.full_name || "Peniaga"}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${displayType === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {displayType === 'income' ? '+' : '-'} RM {tx.amount.toFixed(2)}
                                                </p>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground capitalize">
                                                    {tx.status}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-8 rounded-3xl border border-dashed border-border text-center">
                        <p className="text-muted-foreground text-sm">Tiada transaksi direkodkan.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
