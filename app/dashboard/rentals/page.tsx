import { fetchDashboardData } from "@/utils/data/dashboard"
import { EnhancedRentalModule } from "@/components/rental-module-enhanced"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RentalsPage() {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Get tenant data for the user
    const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle()

    // Get linked organizers
    let linkedOrganizers: any[] = []
    if (tenantData) {
        const { data: orgData } = await supabase
            .from('tenant_organizers')
            .select(`
                *,
                organizers(id, name, organizer_code, email)
            `)
            .eq('tenant_id', tenantData.id)
            .order('requested_at', { ascending: false })
        
        linkedOrganizers = orgData || []
    }

    // Get approved organizer IDs
    const approvedOrgIds = linkedOrganizers
        .filter((link: any) => link.status === 'approved' || link.status === 'active')
        .map((link: any) => link.organizer_id)

    // Get available locations directly (not using RPC)
    let availableLocations: any[] = []
    if (tenantData && approvedOrgIds.length > 0) {
        // Get locations from approved organizers
        const { data: locData } = await supabase
            .from('locations')
            .select(`
                id,
                name,
                rate_khemah,
                rate_cbs,
                rate_monthly,
                operating_days,
                type,
                organizer_id,
                organizers!inner(name)
            `)
            .in('organizer_id', approvedOrgIds)
            .eq('status', 'active')
            .order('name')
        
        // Get already assigned location IDs
        const { data: assignedLocs } = await supabase
            .from('tenant_locations')
            .select('location_id')
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
        
        const assignedIds = new Set((assignedLocs || []).map((l: any) => l.location_id))
        
        // Filter out already assigned locations
        availableLocations = (locData || [])
            .filter((loc: any) => !assignedIds.has(loc.id))
            .map((l: any) => ({
                location_id: l.id,
                location_name: l.name,
                organizer_id: l.organizer_id,
                organizer_name: l.organizers?.name,
                rate_khemah: l.rate_khemah,
                rate_cbs: l.rate_cbs,
                rate_monthly: l.rate_monthly,
                operating_days: l.operating_days || 'Setiap Hari',
                type: l.type,
                display_price: l.rate_monthly || l.rate_khemah || 0
            }))
    }

    // Get my locations
    let myLocations: any[] = []
    if (tenantData) {
        const { data: locData } = await supabase
            .from('tenant_locations')
            .select(`*, locations:location_id (*)`)
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
        
        myLocations = (locData || []).map((item: any) => ({
            ...item,
            display_price: item.locations?.rate_monthly || item.locations?.rate_khemah || 0,
            location_name: item.locations?.name
        }))
    }

    // Get payment history from tenant_payments table (where rent payments are stored)
    let history: any[] = []
    if (tenantData) {
        const { data: paymentData } = await supabase
            .from('tenant_payments')
            .select('*')
            .eq('tenant_id', tenantData.id)
            .order('payment_date', { ascending: false })
        
        history = (paymentData || []).map(payment => ({
            id: payment.id,
            payment_date: payment.payment_date,
            remarks: payment.remarks || `Bayaran sewa - ${payment.payment_method || 'Online'}`,
            amount: payment.amount,
            status: payment.status,
            receipt_url: payment.receipt_url,
            payment_method: payment.payment_method,
            billplz_id: payment.billplz_id,
            is_sandbox: payment.is_sandbox
        }))
    }

    return (
        <EnhancedRentalModule
            initialTenant={tenantData}
            initialLocations={myLocations}
            initialHistory={history}
            initialAvailable={availableLocations}
            initialLinkedOrganizers={linkedOrganizers}
        />
    )
}
