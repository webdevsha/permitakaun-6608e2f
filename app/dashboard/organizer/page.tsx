import { fetchDashboardData, fetchLocations } from "@/utils/data/dashboard"
import { Users, MapPin, TrendingUp, AlertCircle, ArrowRight, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function OrganizerDashboardPage() {
    const dashboardData = await fetchDashboardData()
    const locations = await fetchLocations()

    const { tenants, overdueTenants, userProfile, role } = dashboardData
    const displayRole = "Penganjur"

    const activeTenantsCount = tenants.filter((t: any) => t.status === 'active').length

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Hai, <span className="text-primary italic">{userProfile?.full_name || "Penganjur"}</span>
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Pantau lokasi dan penyewa di bawah seliaan anda.
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
                            {locations.length}
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
                            {tenants.length}
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
                            {overdueTenants.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-xs text-orange-700/80 bg-orange-100/50 px-3 py-1 rounded-full w-fit">
                            <AlertCircle size={14} />
                            <span>RM {overdueTenants.reduce((acc: number, t: any) => acc + t.arrears, 0).toLocaleString()} Lewat</span>
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

                    {locations.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {locations.slice(0, 3).map((loc: any) => (
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

                    {tenants.length > 0 ? (
                        <div className="space-y-4">
                            {tenants.slice(0, 4).map((t: any) => (
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
        </div>
    )
}
