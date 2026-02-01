import { fetchDashboardData } from "@/utils/data/dashboard"
import { ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function TenantDashboardPage() {
    const data = await fetchDashboardData()
    const { role, myLocations } = data
    const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Peniaga"

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
