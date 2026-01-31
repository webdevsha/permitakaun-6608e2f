import { fetchDashboardData } from "@/utils/data/dashboard"
import { createClient } from "@/utils/supabase/server"
import { Users, AlertCircle, TrendingUp, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { RecentTransactions } from "@/components/recent-transactions"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const data = await fetchDashboardData()

  const { transactions, tenants, overdueTenants, role, myLocations } = data
  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Pengguna"

  // Tenant View
  if (role === 'tenant') {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
              Hai, <span className="text-primary italic">{data.userProfile?.full_name || displayRole}</span>
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
        </div>
      </div>
    )
  }

  // Admin/Staff/Organizer View
  const totalIncome = transactions
    .filter((t: any) => t.type === 'income' && t.status === 'approved')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

  const activeTenantsCount = tenants.filter((t: any) => t.status === 'active').length

  return (
    <>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground tracking-tighter">
            Hai, <span className="text-primary italic">{displayRole}</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl font-medium tracking-tight opacity-70">
            Ringkasan operasi dan kewangan semasa.
          </p>
        </div>
        <div className="hidden md:flex bg-white px-6 py-3 rounded-2xl text-primary font-bold border border-border/50 shadow-sm items-center gap-3 text-sm">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
          {new Date().toLocaleDateString("ms-MY", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </header>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20 rounded-[2rem]">
            <CardHeader className="pb-2">
              <CardDescription className="text-primary-foreground/80 font-medium text-xs uppercase tracking-wider">Jumlah Kutipan</CardDescription>
              <CardTitle className="text-3xl lg:text-4xl font-sans font-bold">
                RM {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs bg-primary-foreground/10 w-fit px-3 py-1 rounded-full">
                <TrendingUp size={14} />
                <span>{transactions.filter((t: any) => t.type === 'income').length} Transaksi</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium text-xs uppercase tracking-wider">Peniaga Berdaftar</CardDescription>
              <CardTitle className="text-3xl lg:text-4xl font-sans font-bold text-foreground">
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
              <CardDescription className="text-orange-800/70 font-medium text-xs uppercase tracking-wider">Tunggakan</CardDescription>
              <CardTitle className="text-3xl lg:text-4xl font-sans font-bold text-orange-700">
                RM {overdueTenants.reduce((acc: number, t: any) => acc + t.arrears, 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-orange-700/80 bg-orange-100/50 px-3 py-1 rounded-full w-fit">
                <AlertCircle size={14} />
                <span>{overdueTenants.length} Kes Lewat</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left Column: Transaction List */}
          <div className="xl:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-serif font-semibold">Transaksi Terkini</h2>
              <Link href="/dashboard/accounting" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                Lihat Semua <ArrowRight size={14} />
              </Link>
            </div>
            <RecentTransactions data={transactions} />
          </div>

          {/* Right Column: Problematic Tenants List */}
          <div className="space-y-6">
            <h2 className="text-xl font-serif font-semibold">Senarai Tunggakan</h2>

            <Card className="bg-white border-border/50 shadow-sm rounded-3xl overflow-hidden h-fit">
              <CardHeader className="bg-red-50/50 border-b border-red-100/50 py-4">
                <CardTitle className="text-base flex items-center gap-2 text-red-900">
                  <AlertCircle size={18} className="text-red-600" />
                  {overdueTenants.length} Peniaga Lewat Bayar
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-[400px]">
                {overdueTenants.length > 0 ? (
                  <ul className="divide-y divide-border/30">
                    {overdueTenants.map((t: any) => (
                      <li key={t.id} className="p-4 hover:bg-red-50/30 transition-colors flex justify-between items-center group">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-foreground">{t.full_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.business_name} • {t.locationName}</p>
                          <p className="text-xs text-red-600 font-bold mt-1">
                            Tunggakan: RM {t.arrears}
                          </p>
                        </div>
                        <Link href={`/dashboard/tenants?search=${t.full_name}`}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight size={14} />
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <p>Tiada tunggakan dikesan.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
