import { fetchDashboardData } from "@/utils/data/dashboard"
import { Users, Building, Shield, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        .eq('id', user.id)
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

    const { tenants, organizers } = data

    // Calculate metrics
    const totalTenants = tenants?.length || 0
    const totalOrganizers = organizers?.length || 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
                <p className="text-muted-foreground">
                    {role === 'staff' ? 'Staff Access' : 'Pentadbiran Sistem'}
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Peniaga</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalTenants}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Penganjur</CardTitle>
                        <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrganizers}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Akaun</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            <Link href="/dashboard/accounting" className="text-primary hover:underline">
                                Buka
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                    <Link href="/dashboard/tenants">
                        <Users className="h-6 w-6" />
                        <span>Senarai Peniaga</span>
                    </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                    <Link href="/dashboard/organizers">
                        <Building className="h-6 w-6" />
                        <span>Senarai Penganjur</span>
                    </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
                    <Link href="/dashboard/accounting">
                        <CreditCard className="h-6 w-6" />
                        <span>Akaun & Kewangan</span>
                    </Link>
                </Button>
            </div>
        </div>
    )
}
