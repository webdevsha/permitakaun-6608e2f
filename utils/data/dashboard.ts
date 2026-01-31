import { createClient } from "@/utils/supabase/server"

export async function fetchDashboardData() {
    const supabase = await createClient()

    // Get User Role Context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role: null, userProfile: null }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'tenant'

    let tenants: any[] = []
    let transactions: any[] = []
    let organizers: any[] = []
    let myLocations: any[] = []
    let availableLocations: any[] = []
    let userProfile: any = null

    // --- ADMIN & STAFF: Fetch ALL ---
    if (role === 'admin' || role === 'staff') {
        // Fetch Tenants with Locations
        const { data: t } = await supabase
            .from('tenants')
            .select('*, tenant_locations(*, locations(*))')
            .order('created_at', { ascending: false })

        // Enrich Tenants with Payment Status (Server-side simulation of client logic)
        if (t) {
            // Fetch last approved payments for all tenants efficiently
            // Note: For large datasets, this strategy might need optimization (e.g. SQL view)
            const { data: payments } = await supabase
                .from('tenant_payments')
                .select('*')
                .eq('status', 'approved')
                .order('payment_date', { ascending: false })

            tenants = t.map(tenant => {
                const lastPayment = payments?.find((p: any) => p.tenant_id === tenant.id)
                let paymentStatus = 'active'
                if (!lastPayment) paymentStatus = 'new'

                return {
                    ...tenant,
                    locations: tenant.tenant_locations?.map((l: any) => l.locations?.name) || [],
                    lastPaymentDate: lastPayment?.payment_date
                        ? new Date(lastPayment.payment_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                        : "Tiada Rekod",
                    lastPaymentAmount: lastPayment?.amount || 0,
                    paymentStatus
                }
            })
        }

        const { data: tx } = await supabase
            .from('transactions')
            .select('*, tenants(full_name, business_name)')
            .order('date', { ascending: false })
        transactions = tx || []

        const { data: org } = await supabase.from('organizers').select('*').order('created_at', { ascending: false })
        organizers = org || []

        // --- ORGANIZER: Fetch Linked Data Only ---
    } else if (role === 'organizer') {
        const { data: org } = await supabase.from('organizers').select('id, organizer_code').eq('profile_id', user.id).single()

        if (org && org.organizer_code) {
            // Fetch Tenants for this organizer
            const { data: t } = await supabase
                .from('tenants')
                .select('*, tenant_locations(*, locations(*))')
                .eq('organizer_code', org.organizer_code)

            // Enrich Tenants (similar logic)
            if (t) {
                const { data: payments } = await supabase
                    .from('tenant_payments')
                    .select('*')
                    .eq('status', 'approved')
                    .in('tenant_id', t.map(x => x.id))
                    .order('payment_date', { ascending: false })

                tenants = t.map(tenant => {
                    const lastPayment = payments?.find((p: any) => p.tenant_id === tenant.id)
                    let paymentStatus = 'active'
                    if (!lastPayment) paymentStatus = 'new'
                    return {
                        ...tenant,
                        locations: tenant.tenant_locations?.map((l: any) => l.locations?.name) || [],
                        lastPaymentDate: lastPayment?.payment_date
                            ? new Date(lastPayment.payment_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                            : "Tiada Rekod",
                        lastPaymentAmount: lastPayment?.amount || 0,
                        paymentStatus
                    }
                })
            }

            // Fetch Transactions for these tenants only
            if (tenants.length > 0) {
                const tenantIds = tenants.map((t: any) => t.id)
                const { data: tx } = await supabase
                    .from('transactions')
                    .select('*, tenants(full_name, business_name)')
                    .in('tenant_id', tenantIds)
                    .order('date', { ascending: false })
                transactions = tx || []
            }
        }
        // --- TENANT VIEW ---
    } else {
        // 1. Get Tenant Profile
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle()

        // Fallback: Check email if profile_id not linked
        let currentTenant = tenantData
        if (!currentTenant && user.email) {
            const { data: tenantByEmail } = await supabase
                .from('tenants')
                .select('*')
                .eq('email', user.email)
                .maybeSingle()
            currentTenant = tenantByEmail
        }

        if (currentTenant) {
            userProfile = currentTenant

            // 2. Get My Locations
            const { data: locData } = await supabase
                .from('tenant_locations')
                .select(`*, locations:location_id (*)`)
                .eq('tenant_id', currentTenant.id)

            if (locData) {
                myLocations = locData.map((item: any) => {
                    let price = 0
                    if (item.rate_type === 'khemah') price = item.locations.rate_khemah
                    else if (item.rate_type === 'cbs') price = item.locations.rate_cbs
                    else if (item.rate_type === 'monthly') price = item.locations.rate_monthly

                    return {
                        ...item,
                        display_price: price,
                        location_name: item.locations.name
                    }
                })
            }

            // 3. Get History
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .order('date', { ascending: false })

            if (txData) {
                transactions = txData.map(tx => ({
                    id: tx.id,
                    payment_date: tx.date,
                    remarks: tx.description,
                    amount: tx.amount,
                    status: tx.status,
                    receipt_url: tx.receipt_url
                }))
            }

            // 4. Available Locations (if organizer code exists)
            if (currentTenant.organizer_code) {
                const { data: orgData } = await supabase
                    .from('organizers')
                    .select('id')
                    .eq('organizer_code', currentTenant.organizer_code)
                    .maybeSingle()

                if (orgData) {
                    const { data: filteredLocs } = await supabase
                        .from('locations')
                        .select('*')
                        .eq('organizer_id', orgData.id)
                        .order('name')
                    availableLocations = filteredLocs || []
                }
            }
        }
    }

    // 3. Logic: Calculate Overdue based on Rate Type (Common for Dashboard Overview)
    const overdueTenants = []

    if ((role === 'admin' || role === 'staff' || role === 'organizer') && tenants && transactions) {
        for (const t of tenants) {
            // Find last approved income (need to re-fetch or find in tx list if it contains all)
            // The 'transactions' array above contains ALL transactions for Admin/Staff
            // For Organizer it contains filtered.
            // So we can use it.
            const lastTx = transactions.find(
                (tx: any) => tx.tenant_id === t.id && tx.type === 'income' && tx.status === 'approved'
            )

            // Determine primary rate type from assigned locations (take first for simplicity)
            const loc = t.tenant_locations?.[0]
            const rateType = loc?.rate_type || 'monthly' // Default to monthly if unknown
            const locationName = loc?.locations?.name || 'Unknown'

            // Calculate Days passed
            let daysDiff = 0
            let lastDateStr = 'Tiada Rekod'

            if (!lastTx) {
                daysDiff = 999 // Never paid
            } else {
                const lastDate = new Date(lastTx.date)
                const today = new Date()
                const diffTime = Math.abs(today.getTime() - lastDate.getTime())
                daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                lastDateStr = lastTx.date
            }

            // --- Overdue Logic ---
            let isOverdue = false
            let arrearsAmount = 0
            let overdueText = ""

            if (rateType === 'monthly') {
                // Monthly renews monthly (30 days)
                if (daysDiff > 30) {
                    isOverdue = true
                    const monthsOverdue = Math.floor(daysDiff / 30)
                    const rate = loc?.locations?.rate_monthly || 0
                    arrearsAmount = monthsOverdue * rate
                    overdueText = `${monthsOverdue} Bulan`
                }
            } else {
                // Daily/Khemah/CBS renews WEEKLY (7 days)
                if (daysDiff > 7) {
                    isOverdue = true
                    const weeksOverdue = Math.floor(daysDiff / 7)
                    const rate = rateType === 'cbs' ? (loc?.locations?.rate_cbs || 0) : (loc?.locations?.rate_khemah || 0)
                    arrearsAmount = weeksOverdue * rate
                    overdueText = `${weeksOverdue} Minggu`
                }
            }

            if (isOverdue) {
                overdueTenants.push({
                    ...t,
                    lastDate: lastDateStr,
                    arrears: arrearsAmount,
                    overdueText,
                    locationName
                })
            }
        }
    }

    return {
        transactions,
        tenants,
        overdueTenants,
        organizers,
        myLocations,
        availableLocations,
        userProfile,
        role
    }
}
