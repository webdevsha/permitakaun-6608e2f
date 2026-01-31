import { createClient } from "@/utils/supabase/server"

export async function fetchDashboardData() {
    const supabase = await createClient()

    // Get User Role Context
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { transactions: [], tenants: [], overdueTenants: [], role: null }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'tenant'

    let tenants = []
    let transactions = []

    // --- ADMIN & STAFF: Fetch ALL ---
    if (role === 'admin' || role === 'staff') {
        const { data: t } = await supabase
            .from('tenants')
            .select('*, tenant_locations(*, locations(*))')
        tenants = t || []

        const { data: tx } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
        transactions = tx || []

        // --- ORGANIZER: Fetch Linked Data Only ---
    } else if (role === 'organizer') {
        const { data: org } = await supabase.from('organizers').select('id, organizer_code').eq('profile_id', user.id).single()

        if (org && org.organizer_code) {
            // Fetch Tenants for this organizer
            const { data: t } = await supabase
                .from('tenants')
                .select('*, tenant_locations(*, locations(*))')
                .eq('organizer_code', org.organizer_code)
            tenants = t || []

            // Fetch Transactions for these tenants only
            if (tenants.length > 0) {
                const tenantIds = tenants.map((t: any) => t.id)
                const { data: tx } = await supabase
                    .from('transactions')
                    .select('*')
                    .in('tenant_id', tenantIds)
                    .order('date', { ascending: false })
                transactions = tx || []
            }
        }
    }

    // 3. Logic: Calculate Overdue based on Rate Type
    const overdueTenants = []

    if (tenants && transactions) {
        for (const t of tenants) {
            // Find last approved income
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
        transactions: transactions || [],
        tenants: tenants || [],
        overdueTenants,
        role
    }
}
