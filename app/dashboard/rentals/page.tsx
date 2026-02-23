import { fetchDashboardData } from "@/utils/data/dashboard"
import { EnhancedRentalModule } from "@/components/rental-module-enhanced"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'
export const revalidate = 0

// This page handles ALL tenants (not just tenant_id 44)
// It fetches the current user's tenant data and displays their payment history
export default async function RentalsPage() {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        redirect('/login')
    }

    // Get tenant data for the CURRENT user (works for ALL tenants)
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

    // Get locations ONLY from organizers this tenant is approved/active with
    let allLocations: any[] = []
    let availableLocations: any[] = []

    if (tenantData) {
        // Only show locations from approved organizers
        const approvedOrgIds = linkedOrganizers
            .filter((lo: any) => lo.status === 'approved' || lo.status === 'active')
            .map((lo: any) => lo.organizer_id)
            .filter(Boolean)

        if (approvedOrgIds.length > 0) {
            const { data: locData } = await supabase
                .from('locations')
                .select('*')
                .in('organizer_id', approvedOrgIds)
                .eq('status', 'active')
                .order('program_name')

            const orgIds = [...new Set((locData || []).map((l: any) => l.organizer_id).filter(Boolean))]
            const { data: orgsData } = orgIds.length > 0
                ? await supabase.from('organizers').select('id, name').in('id', orgIds)
                : { data: [] }

            const orgMap = new Map((orgsData || []).map((o: any) => [o.id, o.name]))

            const { data: assignedLocs } = await supabase
                .from('tenant_locations')
                .select('location_id')
                .eq('tenant_id', tenantData.id)
                .eq('is_active', true)

            const assignedIds = new Set((assignedLocs || []).map((l: any) => l.location_id))

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
                map_url: l.map_url,
                address: l.address,
                image_url: l.image_url,
                description: l.description,
                is_assigned: assignedIds.has(l.id)
            }))

            availableLocations = allLocations.filter((loc: any) => !loc.is_assigned)
        }
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
            map_url: item.locations?.map_url,
            address: item.locations?.address,
            image_url: item.locations?.image_url,
            description: item.locations?.description,
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

    // Get payment history from BOTH:
    // 1. tenant_payments table (online/manual payments)
    // 2. tenant_transactions table (rent expenses recorded in Akaun)
    // This ensures Sejarah Bayaran tallies with Senarai Transaksi in Akaun
    // Works for ALL tenants (tenant_id 44 and every other tenant)
    let history: any[] = []
    if (tenantData) {
        console.log(`[RentalsPage] Fetching payment history for tenant_id: ${tenantData.id}`)
        // Use admin client to bypass RLS on tenant_payments (tenant SELECT policy may not exist)
        const { data: paymentData } = await adminSupabase
            .from('tenant_payments')
            .select(`
                *,
                locations:location_id (name, program_name),
                organizers:organizer_id (name, organizer_code)
            `)
            .eq('tenant_id', tenantData.id)
            .order('payment_date', { ascending: false })
        
        const paymentHistory = (paymentData || []).map(payment => ({
            id: `tp_${payment.id}`,
            source: 'tenant_payments',
            payment_date: payment.payment_date,
            remarks: payment.remarks || `Bayaran sewa - ${payment.payment_method || 'Online'}`,
            amount: payment.amount,
            type: 'expense', // Cash out
            status: payment.status,
            receipt_url: payment.receipt_url,
            payment_method: payment.payment_method,
            billplz_id: payment.billplz_id,
            is_sandbox: payment.is_sandbox,
            // Location info
            location_name: payment.locations?.name,
            program_name: payment.locations?.program_name,
            // Organizer info
            organizer_name: payment.organizers?.name,
            organizer_code: payment.organizers?.organizer_code
        }))

        // Fetch from tenant_transactions (rent-related expenses recorded in Akaun)
        // Also get location/organizer info from tenant_locations
        const { data: transactionData } = await supabase
            .from('tenant_transactions')
            .select('*')
            .eq('tenant_id', tenantData.id)
            .in('category', ['Sewa', 'Bayaran Sewa', 'Rent', 'Rental'])
            .order('date', { ascending: false })
        
        // Get tenant's locations with organizer info for linking
        // Also get organizer info from locations table if tenant_locations.organizer_id is NULL
        const { data: tenantLocs } = await supabase
            .from('tenant_locations')
            .select(`
                *,
                locations:location_id (name, program_name, organizer_id),
                organizers:organizer_id (name, organizer_code)
            `)
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
        
        // Also fetch all organizers for this tenant's locations (fallback)
        const locationIds = tenantLocs?.map((tl: any) => tl.location_id).filter(Boolean) || []
        let organizersMap = new Map()
        if (locationIds.length > 0) {
            const { data: locOrgs } = await supabase
                .from('locations')
                .select('id, organizer_id, organizers:organizer_id (name, organizer_code)')
                .in('id', locationIds)
            locOrgs?.forEach((loc: any) => {
                organizersMap.set(loc.id, loc.organizers)
            })
        }
        
        // Create a lookup map for locations
        const locationMap = new Map()
        tenantLocs?.forEach((tl: any) => {
            // Try to get organizer from tenant_locations first, then from locations table
            const organizerFromTL = tl.organizers
            const organizerFromLoc = organizersMap.get(tl.location_id)
            const organizer = organizerFromTL || organizerFromLoc
            
            locationMap.set(tl.location_id, {
                location_name: tl.locations?.name,
                program_name: tl.locations?.program_name,
                organizer_name: organizer?.name,
                organizer_code: organizer?.organizer_code
            })
        })
        
        // Default to first location if available
        const firstLoc = locationMap.values().next().value
        const defaultLocation = firstLoc || null
        
        const transactionHistory = (transactionData || []).map(tx => {
            // Try to extract location from description or use default
            // Example: "Bayaran Sewa - Lokasi ABC" or "Sewa Uptown"
            let matchedLocation = null
            
            // Try to match location name in description
            if (tx.description) {
                for (const [locId, locInfo] of locationMap) {
                    if (tx.description.toLowerCase().includes((locInfo.location_name || '').toLowerCase())) {
                        matchedLocation = locInfo
                        break
                    }
                }
            }
            
            // Use matched location or default
            const locationInfo = matchedLocation || defaultLocation || {
                location_name: null,
                program_name: null,
                organizer_name: null,
                organizer_code: null
            }
            
            return {
                id: `tt_${tx.id}`,
                source: 'tenant_transactions',
                payment_date: tx.date,
                remarks: tx.description || `Bayaran Sewa (${tx.category})`,
                amount: tx.amount,
                type: tx.type || 'expense',
                status: tx.status,
                receipt_url: tx.receipt_url,
                payment_method: 'Akaun',
                billplz_id: null,
                is_sandbox: false,
                // Location/organizer info from matching or default
                location_name: locationInfo.location_name,
                program_name: locationInfo.program_name,
                organizer_name: locationInfo.organizer_name,
                organizer_code: locationInfo.organizer_code
            }
        })

        // Combine and sort by date (newest first)
        history = [...paymentHistory, ...transactionHistory]
            .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
            .slice(0, 100) // Limit to 100 records
        
        console.log(`[RentalsPage] Tenant ${tenantData.id}: ${paymentHistory.length} payments + ${transactionHistory.length} transactions = ${history.length} total`)
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
