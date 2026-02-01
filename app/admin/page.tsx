import { fetchDashboardData } from "@/utils/data/dashboard"
import { Users, Building, Shield, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { AddStaffDialog } from "@/components/add-staff-dialog"

export default async function AdminDashboardPage() {
    const data = await fetchDashboardData()
    const supabase = await createClient()

    // Fetch Staff List
    const { data: staffList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .order('created_at', { ascending: false })

    const { tenants, organizers } = data

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tighter">
                        Admin Panel
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Pusat kawalan sistem dan pengurusan staf.
                    </p>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Jumlah Penganjur</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold">{organizers.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/organizers">
                            <Button variant="ghost" className="text-primary p-0 h-auto font-bold text-xs">
                                Lihat Semua <ArrowRight className="ml-1 w-3 h-3" />
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="bg-white border-border/50 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Jumlah Peniaga</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold">{tenants.length}</CardTitle>
                    </CardHeader>
                </Card>

                <Card className="bg-primary/5 border-primary/20 shadow-sm rounded-[2rem]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary/70 font-medium text-xs uppercase tracking-wider">Staf Berdaftar</CardDescription>
                        <CardTitle className="text-4xl font-sans font-bold text-primary">{staffList?.length || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AddStaffDialog />
                    </CardContent>
                </Card>
            </div>

            {/* Staff Management Section */}
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-serif font-semibold flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Pengurusan Staf
                    </h2>
                </div>

                <div className="bg-white border border-border/50 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-6">
                        {staffList && staffList.length > 0 ? (
                            <div className="divide-y divide-border/30">
                                {staffList.map((staff: any) => (
                                    <div key={staff.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold">
                                                {staff.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{staff.full_name || staff.email}</p>
                                                <p className="text-xs text-muted-foreground">{staff.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Aktif</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Tiada staf didaftarkan lagi.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ArrowRight({ className }: { className?: string }) {
    return (
        <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.1584 3.13508C6.35985 2.94621 6.67627 2.95642 6.86514 3.15788L10.6151 7.15788C10.7985 7.35357 10.7985 7.64643 10.6151 7.84212L6.86514 11.8421C6.67627 12.0436 6.35985 12.0538 6.1584 11.8649C5.95694 11.676 5.94673 11.3596 6.1356 11.1581L9.5915 7.50002L6.1356 3.84194C5.94673 3.64048 5.95694 3.32406 6.1584 3.13508Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
        </svg>
    )
}
