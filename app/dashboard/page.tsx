import { fetchDashboardData } from "@/utils/data/dashboard"
import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Dashboard entry point - performs role-based routing
 * 
 * IMPORTANT: This page runs server-side, preventing client-side
 * flickering by determining the correct destination before rendering.
 */
export default async function DashboardPage() {
  // Get fresh session and profile data server-side
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/login')
  }
  
  // Fetch profile for role determination
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organizer_code, full_name, email')
    .eq('id', user.id)
    .single()
  
  // Determine role using consistent logic
  const role = determineUserRole(profile, user.email)

  // Role-based routing
  if (role === 'organizer') {
    redirect('/dashboard/organizer')
  }

  if (role === 'tenant') {
    redirect('/dashboard/tenant')
  }

  if (role === 'admin' || role === 'staff' || role === 'superadmin') {
    redirect('/admin')
  }

  // Fallback: If role cannot be determined, show error/loading state
  // This should rarely happen as determineUserRole defaults to 'tenant'
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <p className="text-muted-foreground">Unable to determine user role. Please contact support.</p>
    </div>
  )
}
