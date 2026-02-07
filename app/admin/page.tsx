import { fetchDashboardData } from "@/utils/data/dashboard"
import { Users, Building, Shield, CreditCard, PlusCircle, MapPin, UserPlus, FileText, Activity, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"
import { Suspense } from "react"

// Loading skeleton
function AdminSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid gap-6 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="h-28 bg-gray-100">
                        <CardContent className="p-6">
                            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function AdminContent({ user, role, profile }: { user: any, role: string, profile: any }) {
    const supabase = await createClient()
    
    // Fetch data with error handling
    let data;
    try {
        data = await fetchDashboardData()
    } catch (e) {
        console.error('[Admin] Error fetching dashboard data:', e)
        data = { tenants: [], organizers: [], transactions: [], user: user, role: role }
    }

    if (!data.user) {
        redirect('/login')
    }

    const { tenants, organizers } = data

    // Determine admin org code
    let adminOrgCode = null
    if (user?.email === 'admin@permit.com') {
        adminOrgCode = 'ORG001'
    } else if (user?.email === 'admin@kumim.my') {
        adminOrgCode = 'ORG002'
    }

    // Fetch staff count
    let staffCount = 0
    try {
        let staffQuery = supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'staff')
        
        if (adminOrgCode) {
            staffQuery = staffQuery.eq('organizer_code', adminOrgCode)
        }
        
        const { count } = await staffQuery
        staffCount = count || 0
    } catch (e) {
        console.error('[Admin] Error fetching staff count:', e)
    }

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
                        <CardTitle className="text-sm font-medium">Staff</CardTitle>
                        <Shield className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{staffCount}</div>
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

    return (
        <Suspense fallback={<AdminSkeleton />}>
            <AdminContent user={user} role={role} profile={profile} />
        </Suspense>
    )
}
