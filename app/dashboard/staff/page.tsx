import { createClient } from "@/utils/supabase/server"
import { Shield, UserPlus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddStaffDialog } from "@/components/add-staff-dialog"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_STAFF = 2

export default async function StaffPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Get current user profile to determine organization/role
    const { data: profile } = await supabase.from('profiles').select('role, organizer_code').eq('id', user.id).single()
    const currentUserRole = profile?.role

    // Only Admins and Superadmins should see this
    if (currentUserRole !== 'admin' && currentUserRole !== 'superadmin') {
        redirect('/dashboard')
    }

    // Determine the organizer code for the current admin
    let adminOrgCode = null
    if (user?.email === 'admin@permit.com') {
        adminOrgCode = 'ORG001'
    } else if (user?.email === 'admin@kumim.my') {
        adminOrgCode = 'ORG002'
    } else {
        adminOrgCode = profile?.organizer_code
    }

    // Fetch Staff List
    let staffQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .order('created_at', { ascending: false })

    // Filter by organizer_code if admin has an organization
    if (adminOrgCode) {
        staffQuery = staffQuery.eq('organizer_code', adminOrgCode)
    }

    const { data: staffList } = await staffQuery
    const staffCount = staffList?.length || 0
    const hasReachedLimit = staffCount >= MAX_STAFF

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-border/30">
                <div className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tighter flex items-center gap-3">
                        <Shield className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                        Pengurusan Staf
                    </h1>
                    <p className="text-muted-foreground text-lg font-medium">
                        Urus akses dan akaun staf untuk organisasi anda.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Had maksimum: <span className={hasReachedLimit ? "text-amber-600 font-bold" : "font-medium"}>{staffCount}/{MAX_STAFF} staf</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {hasReachedLimit && (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            <AlertCircle className="w-3 h-3 mr-1" /> Had dicapai
                        </Badge>
                    )}
                    <AddStaffDialog currentStaffCount={staffCount} maxStaff={MAX_STAFF} organizerCode={adminOrgCode} />
                </div>
            </header>

            {/* Staff Limit Warning */}
            {hasReachedLimit && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                    <p className="font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Had Maksimum Staf
                    </p>
                    <p className="text-sm mt-1">
                        Anda telah mencapai had maksimum {MAX_STAFF} staf. Untuk menambah staf baharu, 
                        sila padam staf sedia ada atau hubungi penyelia sistem.
                    </p>
                </div>
            )}

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
                        <div className="text-center py-12 text-muted-foreground">
                            <div className="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                            <p className="text-lg font-medium">Tiada staf didaftarkan.</p>
                            <p className="text-sm">Klik &quot;Tambah Staf&quot; untuk mula mendaftar staf baru.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Users({ className }: { className?: string }) {
    return (
        <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
