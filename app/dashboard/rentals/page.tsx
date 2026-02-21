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

    // Get all locations from approved organizers (for showing all programs)
    let allLocations: any[] = []
    let availableLocations: any[] = []
    
    if (tenantData && approvedOrgIds.length > 0) {
        // Get ALL locations from approved organizers
        // Note: Using separate query for organizers to avoid RLS issues with joins
        const { data: locData, error: locError } = await supabase
            .from('locations')
            .select(`
                id,
                name,
                program_name,
                address,
                google_maps_url,
                rate_khemah,
                rate_cbs,
                rate_monthly,
                rate_monthly_khemah,
                rate_monthly_cbs,
                operating_days,
                type,
                organizer_id
            `)
            .in('organizer_id', approvedOrgIds)
            .eq('status', 'active')
            .order('program_name')
        
        // Get organizer names separately
        const { data: orgsData } = await supabase
            .from('organizers')
            .select('id, name')
            .in('id', approvedOrgIds)
        
        const orgMap = new Map((orgsData || []).map((o: any) => [o.id, o.name]))
        
        // Get already assigned location IDs
        const { data: assignedLocs } = await supabase
            .from('tenant_locations')
            .select('location_id')
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
        
        const assignedIds = new Set((assignedLocs || []).map((l: any) => l.location_id))
        
        // ALL locations (for showing programs)
        allLocations = (locData || []).map((l: any) => ({
            location_id: l.id,
            location_name: l.name,
            program_name: l.program_name,
            organizer_id: l.organizer_id,
            organizer_name: orgMap.get(l.organizer_id) || 'Unknown',
            rate_khemah: l.rate_khemah,
            rate_cbs: l.rate_cbs,
            rate_monthly: l.rate_monthly,
            rate_monthly_khemah: l.rate_monthly_khemah,
            rate_monthly_cbs: l.rate_monthly_cbs,
            operating_days: l.operating_days || 'Setiap Hari',
            type: l.type,
            display_price: l.rate_monthly || l.rate_khemah || 0,
            google_maps_url: l.google_maps_url,
            address: l.address,
            is_assigned: assignedIds.has(l.id) // Mark if already assigned
        }))
        
        // Available locations only (for filtering)
        availableLocations = allLocations.filter((loc: any) => !loc.is_assigned)
    }

    // Get my locations with organizer and program details
    let myLocations: any[] = []
    if (tenantData) {
        const { data: locData } = await supabase
            .from('tenant_locations')
            .select(`
                *,
                locations:location_id (*),
                organizers:organizer_id (name, id)
            `)
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
        
        myLocations = (locData || []).map((item: any) => ({
            ...item,
            display_price: item.locations?.rate_monthly || item.locations?.rate_khemah || 0,
            location_name: item.locations?.name,
            program_name: item.locations?.program_name,
            google_maps_url: item.locations?.google_maps_url,
            address: item.locations?.address,
            // Organizer info for pending status
            organizer_name: item.organizers?.name,
            organizer_id: item.organizer_id,
            // Include all rate fields for category selection filtering
            rate_monthly: item.locations?.rate_monthly,
            rate_khemah: item.locations?.rate_khemah,
            rate_cbs: item.locations?.rate_cbs,
            rate_monthly_khemah: item.locations?.rate_monthly_khemah,
            rate_monthly_cbs: item.locations?.rate_monthly_cbs
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
            initialAllLocations={allLocations}
            initialLinkedOrganizers={linkedOrganizers}
        />
    )
}
