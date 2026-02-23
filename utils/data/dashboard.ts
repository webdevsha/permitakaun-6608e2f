import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"

// Timeout wrapper to prevent infinite hangs
async function withTimeout<T>(
    queryFn: () => PromiseLike<T>,
    ms: number,
    context: string
): Promise<T> {
    return Promise.race([
        queryFn() as Promise<T>,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${context} took longer than ${ms}ms`)), ms)
        )
    ])
}

async function fetchDashboardDataInternal(
    userId: string,
    role: string,
    email: string,
    profileOrganizerCode: string | null
) {
    console.log('[Dashboard] Fetching data for:', { userId, role, email, profileOrganizerCode })
    const supabase = await createClient()

    // Get organizer_code from appropriate table based on role
    let organizerCode = profileOrganizerCode

    // For staff, get organizer_code from staff table (mirrors admin's data)
    if (role === 'staff') {
        try {
            const { data: staffData } = await withTimeout(
                () => supabase.from('staff').select('organizer_code').eq('profile_id', userId).single(),
                3000,
                'staff lookup'
            )
            if (staffData?.organizer_code) {
                organizerCode = staffData.organizer_code
            }
        } catch (e) {
            console.error('[Dashboard] Staff lookup timeout:', e)
        }
    }
    // For admin, get organizer_code from admins table
    else if (role === 'admin') {
        try {
            const { data: adminData } = await withTimeout(
                () => supabase.from('admins').select('organizer_code').eq('profile_id', userId).single(),
                3000,
                'admin lookup'
            )
            if (adminData?.organizer_code) {
                organizerCode = adminData.organizer_code
            }
        } catch (e) {
            console.error('[Dashboard] Admin lookup timeout:', e)
        }
    }

    let tenants: any[] = []
    let transactions: any[] = []
    let organizers: any[] = []
    let myLocations: any[] = []
    let availableLocations: any[] = []
    let userProfile: any = null

    try {
        // --- ADMIN & SUPERADMIN ---
        // Admin sees their own Akaun transactions, ALL organizers, ALL tenants
        // (tenants have is_own=true flag for those linked to admin's organizer_code)
        if (role === 'admin' || role === 'superadmin') {

            // Fetch Admin's own transactions (admin_transactions)
            try {
                console.log(`[Dashboard] Fetching admin transactions for user ${userId}`)
                const { data: adminTx, error: adminError } = await withTimeout(
                    () => supabase
                        .from('admin_transactions')
                        .select('*')
                        .or(`profile_id.eq.${userId},admin_id.eq.${userId}`)
                        .order('date', { ascending: false })
                        .limit(100),
                    5000,
                    'admin transactions query'
                )
                if (adminError) throw adminError
                transactions = (adminTx || []).map(t => ({
                    ...t,
                    table_source: 'admin_transactions',
                    tenants: null
                }))
                console.log(`[Dashboard] Loaded ${transactions.length} admin transactions for user ${userId}`)
            } catch (e: any) {
                console.error('[Dashboard] Error fetching admin transactions:', e.message || e)
                transactions = []
            }

            // Fetch organizer income transactions for admin who is also an organizer (e.g. admin@kumim.my = ORG002)
            if (organizerCode) {
                try {
                    const { data: adminOrg } = await supabase
                        .from('organizers').select('id').eq('organizer_code', organizerCode).maybeSingle()
                    const adminOrgId = adminOrg?.id || null

                    if (adminOrgId) {
                        // Source A: organizer_transactions
                        const { data: orgTx } = await withTimeout(
                            () => supabase
                                .from('organizer_transactions')
                                .select('*, tenants(full_name, business_name)')
                                .eq('organizer_id', adminOrgId)
                                .order('date', { ascending: false })
                                .limit(50),
                            5000, 'admin organizer_transactions query'
                        )
                        const orgTransactions = (orgTx || []).map((t: any) => ({ ...t, table_source: 'organizer_transactions' }))

                        // Source B: tenant_payments fallback
                        const { data: rentPayments } = await withTimeout(
                            () => supabase
                                .from('tenant_payments')
                                .select('*, tenants(id, full_name, business_name), locations(name)')
                                .eq('organizer_id', adminOrgId)
                                .eq('status', 'approved')
                                .order('payment_date', { ascending: false })
                                .limit(100),
                            5000, 'admin rent payments query'
                        )
                        const coveredRefs = new Set(orgTransactions.filter((t: any) => t.payment_reference).map((t: any) => String(t.payment_reference)))
                        const coveredManual = new Set(orgTransactions.filter((t: any) => !t.payment_reference && t.tenant_id).map((t: any) => `${t.tenant_id}_${t.amount}_${String(t.date).slice(0, 10)}`))
                        const rentFallback = (rentPayments || [])
                            .filter((p: any) => {
                                if (p.billplz_id && coveredRefs.has(p.billplz_id)) return false
                                if (!p.billplz_id) { const k = `${p.tenant_id}_${p.amount}_${String(p.payment_date || '').slice(0, 10)}`; if (coveredManual.has(k)) return false }
                                return true
                            })
                            .map((p: any) => ({
                                id: `rent_${p.id}`, date: p.payment_date || p.created_at,
                                description: `Bayaran Sewa - ${p.tenants?.full_name || 'Penyewa'}${p.locations?.name ? ' (' + p.locations.name + ')' : ''}`,
                                category: 'Sewa', amount: p.amount, type: 'income', status: 'approved',
                                receipt_url: p.receipt_url, tenant_id: p.tenant_id, table_source: 'tenant_payments',
                                is_rent_payment: true, tenants: p.tenants, location_name: p.locations?.name,
                                payment_reference: p.billplz_id || null
                            }))

                        // Source C: tenant_transactions fallback
                        const { data: ttForOrg } = await withTimeout(
                            () => supabase
                                .from('tenant_transactions')
                                .select('*, tenants:tenant_id(full_name, business_name), locations:location_id(name)')
                                .eq('organizer_id', adminOrgId)
                                .eq('is_rent_payment', true)
                                .order('date', { ascending: false })
                                .limit(100),
                            5000, 'admin tenant_transactions for organizer query'
                        )
                        const mergedSoFar = [...orgTransactions, ...rentFallback]
                        const allRefs = new Set(mergedSoFar.filter((t: any) => t.payment_reference).map((t: any) => String(t.payment_reference)))
                        const allManual = new Set(mergedSoFar.filter((t: any) => !t.payment_reference && t.tenant_id).map((t: any) => `${t.tenant_id}_${t.amount}_${String(t.date).slice(0, 10)}`))
                        const ttFallback = (ttForOrg || [])
                            .filter((tt: any) => {
                                if (tt.payment_reference && allRefs.has(String(tt.payment_reference))) return false
                                if (!tt.payment_reference) { const k = `${tt.tenant_id}_${tt.amount}_${String(tt.date).slice(0, 10)}`; if (allManual.has(k)) return false }
                                return true
                            })
                            .map((tt: any) => ({
                                id: `tt_org_${tt.id}`, date: tt.date || tt.created_at,
                                description: `Bayaran Sewa - ${tt.tenants?.business_name || tt.tenants?.full_name || 'Penyewa'}${tt.locations?.name ? ' (' + tt.locations.name + ')' : ''}`,
                                category: 'Sewa', amount: tt.amount, type: 'income', status: tt.status || 'approved',
                                receipt_url: tt.receipt_url, tenant_id: tt.tenant_id, table_source: 'tenant_transactions',
                                is_rent_payment: true, tenants: tt.tenants, location_name: tt.locations?.name,
                                payment_reference: tt.payment_reference || null
                            }))

                        const orgIncome = [...orgTransactions, ...rentFallback, ...ttFallback]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        transactions = [...transactions, ...orgIncome]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 200)
                        console.log(`[Dashboard] Admin ${organizerCode}: +${orgIncome.length} organizer income transactions`)
                    }
                } catch (e) {
                    console.error('[Dashboard] Error fetching admin organizer transactions:', e)
                }
            }

            // Fetch ALL organizers for admin's Penganjur page
            try {
                const { data: allOrgs } = await withTimeout(
                    () => supabase
                        .from('organizers')
                        .select('*, locations(*)')
                        .order('name'),
                    5000,
                    'admin all organizers query'
                )
                organizers = allOrgs || []
                console.log(`[Dashboard] Admin loaded ${organizers.length} organizers`)
            } catch (e) {
                console.error('[Dashboard] Error fetching all organizers for admin:', e)
                organizers = []
            }

            // Fetch ALL tenants for admin's Peniaga page
            // Exclude organizer accounts and mark admin's own tenants (is_own=true)
            try {
                // Get admin's organizer_id (by organizer_code) to check tenant_organizers
                let adminOrgId: string | null = null
                if (organizerCode) {
                    const { data: adminOrg } = await supabase
                        .from('organizers')
                        .select('id')
                        .eq('organizer_code', organizerCode)
                        .maybeSingle()
                    adminOrgId = adminOrg?.id || null
                }

                // Get tenant_ids linked to admin's organizer via tenant_organizers
                let ownTenantIds = new Set<number>()
                if (adminOrgId) {
                    const { data: links } = await supabase
                        .from('tenant_organizers')
                        .select('tenant_id')
                        .eq('organizer_id', adminOrgId)
                    ;(links || []).forEach((l: any) => ownTenantIds.add(l.tenant_id))
                }

                // Get organizer profile_ids to exclude from tenants list
                const { data: allOrganizersProfiles } = await supabase
                    .from('organizers')
                    .select('profile_id')
                    .not('profile_id', 'is', null)
                const orgProfileIds = new Set(
                    (allOrganizersProfiles || []).map((o: any) => o.profile_id).filter(Boolean)
                )

                const { data: allTenants } = await withTimeout(
                    () => supabase
                        .from('tenants')
                        .select('*, tenant_locations(location_id, status, locations(name))')
                        .order('full_name'),
                    5000,
                    'admin all tenants query'
                )

                tenants = (allTenants || [])
                    // Exclude accounts that are organizers (profile_id matches an organizer)
                    .filter((t: any) => !t.profile_id || !orgProfileIds.has(t.profile_id))
                    .map((t: any) => ({
                        ...t,
                        // is_own: legacy organizer_code match OR linked via tenant_organizers
                        is_own: (organizerCode && t.organizer_code === organizerCode)
                            || ownTenantIds.has(t.id),
                        locations: t.tenant_locations?.map((l: any) => ({
                            name: l.locations?.name,
                            status: l.status
                        })) || []
                    }))
                console.log(`[Dashboard] Admin loaded ${tenants.length} tenants (excl. organizer accounts)`)
            } catch (e) {
                console.error('[Dashboard] Error fetching all tenants for admin:', e)
                tenants = []
            }
        }
        // --- ORGANIZER ROLE (Self) OR STAFF (Mirrored Admin View) ---
        else if (role === 'organizer' || role === 'staff') {
            let orgId: string | null = null
            let orgCode: string | null = null // Store code for tenant filtering

            if (role === 'organizer') {
                const { data: org } = await withTimeout(
                    () => supabase.from('organizers').select('id, organizer_code').eq('profile_id', userId).single(),
                    3000,
                    'organizer lookup'
                )
                orgId = org?.id
                orgCode = org?.organizer_code
                if (org) organizers = [org]
            } else if (role === 'staff') {
                if (!organizerCode) {
                    return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role, userProfile: null }
                }
                const { data: org } = await withTimeout(
                    () => supabase.from('organizers').select('id, organizer_code').eq('organizer_code', organizerCode).single(),
                    3000,
                    'staff organizer lookup'
                )
                orgId = org?.id
                orgCode = org?.organizer_code
                if (org) organizers = [org]
            }

            if (orgId) {
                // Fetch locations
                try {
                    const { data: locs } = await withTimeout(
                        () => supabase.from('locations').select('*').eq('organizer_id', orgId).order('name').limit(50),
                        3000,
                        'locations query'
                    )
                    myLocations = (locs || []).map((l: any) => ({
                        location_name: l.name,
                        display_price: l.rate_monthly || l.rate_khemah || 0,
                        ...l
                    }))
                } catch (e) {
                    console.error('[Dashboard] Error fetching locations:', e)
                }

                // Fetch Tenants via Junction Table (Many-to-Many)
                if (orgId) {
                    try {
                        const { data: links } = await withTimeout(
                            () => supabase
                                .from('tenant_organizers')
                                .select('*, tenants(*, tenant_locations(*, locations(*)))')
                                .eq('organizer_id', orgId)
                                .order('created_at', { ascending: false }),
                            5000,
                            'organizer tenants query'
                        )

                        tenants = (links || []).map((link: any) => {
                            const t = link.tenants
                            if (!t) return null

                            return {
                                ...t,
                                link_id: link.id,
                                link_status: link.status,
                                organizer_code: orgCode,
                                locations: t.tenant_locations?.map((l: any) => ({
                                    name: l.locations?.name,
                                    status: l.status
                                })) || [],
                                organizerName: '-',
                                lastPaymentDate: "Tiada Rekod",
                                lastPaymentAmount: 0,
                                paymentStatus: 'active'
                            }
                        }).filter(Boolean)
                    } catch (e) {
                        console.error('[Dashboard] Error fetching organizer tenants:', e)
                        tenants = []
                    }
                }

                // Fetch organizer's own transactions
                try {
                    const { data: tx } = await withTimeout(
                        () => supabase
                            .from('organizer_transactions')
                            .select('*, tenants(full_name, business_name)')
                            .eq('organizer_id', orgId)
                            .order('date', { ascending: false })
                            .limit(50),
                        5000,
                        'organizer transactions query'
                    )
                    transactions = (tx || []).map(t => ({ ...t, table_source: 'organizer_transactions' }))
                } catch (e) {
                    console.error('[Dashboard] Error fetching organizer transactions:', e)
                    transactions = []
                }

                // Fallback: include tenant_payments that have NO matching organizer_transaction
                // (covers cases where trigger hasn't fired yet or backfill hasn't run)
                try {
                    const { data: rentPayments } = await withTimeout(
                        () => supabase
                            .from('tenant_payments')
                            .select(`*, tenants(id, full_name, business_name), locations(name)`)
                            .eq('organizer_id', orgId)
                            .eq('status', 'approved')
                            .order('payment_date', { ascending: false })
                            .limit(100),
                        5000,
                        'organizer rent payments query'
                    )

                    // Build sets of already-covered references from organizer_transactions
                    const coveredRefs = new Set(
                        transactions
                            .filter((t: any) => t.payment_reference)
                            .map((t: any) => String(t.payment_reference))
                    )
                    const coveredManual = new Set(
                        transactions
                            .filter((t: any) => !t.payment_reference && t.tenant_id)
                            .map((t: any) => `${t.tenant_id}_${t.amount}_${String(t.date).slice(0, 10)}`)
                    )

                    const fallbackTransactions = (rentPayments || [])
                        .filter(payment => {
                            if (payment.billplz_id && coveredRefs.has(payment.billplz_id)) return false
                            if (!payment.billplz_id) {
                                const key = `${payment.tenant_id}_${payment.amount}_${String(payment.payment_date || '').slice(0, 10)}`
                                if (coveredManual.has(key)) return false
                            }
                            return true
                        })
                        .map(payment => ({
                            id: `rent_${payment.id}`,
                            date: payment.payment_date || payment.created_at,
                            description: `Bayaran Sewa - ${payment.tenants?.full_name || 'Penyewa'} (${payment.locations?.name || 'Lokasi'})`,
                            category: 'Sewa',
                            amount: payment.amount,
                            type: 'income',
                            status: 'approved',
                            receipt_url: payment.receipt_url,
                            tenant_id: payment.tenant_id,
                            table_source: 'tenant_payments',
                            is_rent_payment: true,
                            tenants: payment.tenants,
                            location_name: payment.locations?.name,
                            payment_reference: payment.billplz_id || null
                        }))

                    transactions = [...transactions, ...fallbackTransactions]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 100)

                    console.log(`[Dashboard] Organizer ${orgId}: ${transactions.length} total (${fallbackTransactions.length} fallback from tenant_payments)`)
                } catch (e) {
                    console.error('[Dashboard] Error fetching rent payments:', e)
                }

                // Source 3: tenant_transactions where organizer_id = orgId and is_rent_payment = true
                // Covers cases where organizer_transactions was never created but tenant_transactions exists
                try {
                    const { data: tenantTxForOrg } = await withTimeout(
                        () => supabase
                            .from('tenant_transactions')
                            .select('*, tenants:tenant_id(full_name, business_name), locations:location_id(name)')
                            .eq('organizer_id', orgId)
                            .eq('is_rent_payment', true)
                            .order('date', { ascending: false })
                            .limit(100),
                        5000,
                        'tenant_transactions for organizer query'
                    )

                    if (tenantTxForOrg && tenantTxForOrg.length > 0) {
                        const allCoveredRefs = new Set(
                            transactions
                                .filter((t: any) => t.payment_reference)
                                .map((t: any) => String(t.payment_reference))
                        )
                        const allCoveredManual = new Set(
                            transactions
                                .filter((t: any) => !t.payment_reference && t.tenant_id)
                                .map((t: any) => `${t.tenant_id}_${t.amount}_${String(t.date).slice(0, 10)}`)
                        )

                        const tenantTxFallback = (tenantTxForOrg as any[])
                            .filter((tt: any) => {
                                if (tt.payment_reference && allCoveredRefs.has(String(tt.payment_reference))) return false
                                if (!tt.payment_reference) {
                                    const key = `${tt.tenant_id}_${tt.amount}_${String(tt.date).slice(0, 10)}`
                                    if (allCoveredManual.has(key)) return false
                                }
                                return true
                            })
                            .map((tt: any) => ({
                                id: `tt_org_${tt.id}`,
                                date: tt.date || tt.created_at,
                                description: `Bayaran Sewa - ${tt.tenants?.business_name || tt.tenants?.full_name || 'Penyewa'}${tt.locations?.name ? ' (' + tt.locations.name + ')' : ''}`,
                                category: 'Sewa',
                                amount: tt.amount,
                                type: 'income',
                                status: tt.status || 'approved',
                                receipt_url: tt.receipt_url,
                                tenant_id: tt.tenant_id,
                                table_source: 'tenant_transactions',
                                is_rent_payment: true,
                                tenants: tt.tenants,
                                location_name: tt.locations?.name,
                                payment_reference: tt.payment_reference || null
                            }))

                        transactions = [...transactions, ...tenantTxFallback]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .slice(0, 150)

                        console.log(`[Dashboard] Organizer ${orgId}: +${tenantTxFallback.length} from tenant_transactions (total ${transactions.length})`)
                    }
                } catch (e) {
                    console.error('[Dashboard] Error fetching tenant_transactions for organizer:', e)
                }
            }
        }
        // --- TENANT VIEW ---
        else {
            const { data: tenantData } = await withTimeout(
                () => supabase.from('tenants').select('*').eq('profile_id', userId).maybeSingle(),
                3000,
                'tenant lookup'
            )

            if (tenantData) {
                tenants = [tenantData]
                userProfile = tenantData

                // Fetch locations
                try {
                    const { data: locData } = await withTimeout(
                        () => supabase
                            .from('tenant_locations')
                            .select(`*, locations:location_id (*)`)
                            .eq('tenant_id', tenantData.id)
                            .limit(20),
                        3000,
                        'tenant locations query'
                    )
                    myLocations = (locData || []).map((item: any) => ({
                        ...item,
                        display_price: item.locations?.rate_monthly || item.locations?.rate_khemah || 0,
                        location_name: item.locations?.name
                    }))
                } catch (e) {
                    console.error('[Dashboard] Error fetching tenant locations:', e)
                }

                // Fetch transactions from tenant_transactions
                try {
                    const { data: txData } = await withTimeout(
                        () => supabase
                            .from('tenant_transactions')
                            .select('*')
                            .eq('tenant_id', tenantData.id)
                            .neq('category', 'Langganan')
                            .neq('category', 'Subscription')
                            .order('date', { ascending: false })
                            .limit(50),
                        5000,
                        'tenant transactions query'
                    )
                    transactions = (txData || []).map(tx => ({
                        id: tx.id,
                        date: tx.date,
                        description: tx.description,
                        category: tx.category,
                        amount: tx.amount,
                        type: tx.type,
                        status: tx.status,
                        receipt_url: tx.receipt_url,
                        tenant_id: tx.tenant_id,
                        table_source: 'tenant_transactions'
                    }))
                } catch (e) {
                    console.error('[Dashboard] Error fetching tenant transactions:', e)
                    transactions = []
                }

                // Fetch Linked Organizers (Many-to-Many)
                let linkedOrganizers: any[] = []
                try {
                    const { data: links } = await withTimeout(
                        () => supabase
                            .from('tenant_organizers')
                            .select('*, organizers(id, name, organizer_code, email)')
                            .eq('tenant_id', tenantData.id),
                        3000,
                        'linked organizers query'
                    )

                    linkedOrganizers = (links || []).map((link: any) => ({
                        link_id: link.id,
                        status: link.status,
                        ...link.organizers
                    }))
                } catch (e) {
                    console.error('[Dashboard] Error fetching linked organizers:', e)
                }

                // Fetch Available Locations for this Tenant (based on Linked Organizers)
                // Filter for ACTIVE linked organizers only
                const activeOrgIds = linkedOrganizers
                    .filter(o => o.status === 'active' || o.status === 'approved') // Check status
                    .map(o => o.id)

                // Also include the legacy single organizer_code if it exists and not in linked list
                if (tenantData.organizer_code) {
                    const { data: legacyOrg } = await supabase
                        .from('organizers')
                        .select('id')
                        .eq('organizer_code', tenantData.organizer_code)
                        .maybeSingle()

                    if (legacyOrg && !activeOrgIds.includes(legacyOrg.id)) {
                        activeOrgIds.push(legacyOrg.id)
                    }
                }

                if (activeOrgIds.length > 0) {
                    try {
                        const { data: availLocs } = await supabase
                            .from('locations')
                            .select('*, organizers(name, organizer_code)') // Fetch organizer details too
                            .in('organizer_id', activeOrgIds)
                            .eq('status', 'active')
                            .order('name')

                        availableLocations = (availLocs || []).map((l: any) => ({
                            ...l,
                            display_price: l.rate_monthly || l.rate_khemah || 0,
                            operating_days: l.operating_days || 'Setiap Hari',
                            organizer_name: l.organizers?.name
                        }))
                    } catch (e) {
                        console.error('[Dashboard] Error fetching available locations:', e)
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Dashboard] Unexpected error:', error)
    }

    // Calculate overdue tenants
    const overdueTenants: any[] = []

    return {
        transactions,
        tenants,
        overdueTenants,
        organizers, // Linked organizers for tenants can be passed here or separate field
        linkedOrganizers: role === 'tenant' ? organizers : [], // Actually let's return it as specific field
        myLocations,
        availableLocations,
        userProfile,
        role,
        // Pass linked organizers specifically for RentalModule
        initialLinkedOrganizers: role === 'tenant' ? (userProfile as any)?.linkedOrganizers || [] : []
    }
}

export async function fetchDashboardData() {
    const supabase = await createClient()

    // Add cache-busting timestamp to ensure fresh data
    const timestamp = Date.now()
    console.log(`[fetchDashboardData] Fetching fresh data at ${timestamp}`)

    // Get User with timeout
    let user: any;
    try {
        const authResult: any = await withTimeout(
            () => supabase.auth.getUser(),
            5000,
            'getUser'
        )
        user = authResult.data?.user
    } catch (e) {
        console.error('[fetchDashboardData] Timeout getting user:', e)
        return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role: null, userProfile: null }
    }

    if (!user) {
        return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role: null, userProfile: null }
    }

    // Get profile
    let profile: any
    try {
        const { data } = await withTimeout(
            () => supabase.from('profiles').select('role, organizer_code, full_name, email').eq('id', user.id).single(),
            3000,
            'profile query'
        )
        profile = data
    } catch (e) {
        console.error('[fetchDashboardData] Error fetching profile:', e)
    }

    const role = determineUserRole(profile, user.email)

    // Always return fresh data - no caching
    return await fetchDashboardDataInternal(user.id, role, user.email, profile?.organizer_code)
}

export async function fetchLocations() {
    const supabase = await createClient()

    let user: any;
    try {
        const authResult: any = await withTimeout(
            () => supabase.auth.getUser(),
            5000,
            'fetchLocations getUser'
        )
        user = authResult.data?.user
    } catch (e) {
        console.error('[fetchLocations] Timeout getting user:', e)
        return []
    }

    if (!user) return []

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role

    let query = supabase
        .from('locations')
        .select('*, organizers(name)')
        .order('created_at', { ascending: true })
        .limit(100)

    // Regular organizers only see their own locations
    if (role === 'organizer' && user.email !== 'admin@kumim.my') {
        const { data: org } = await supabase.from('organizers').select('id').eq('profile_id', user.id).single()
        if (org) {
            query = query.eq('organizer_id', org.id)
        } else {
            return []
        }
    }

    // Developer-Admin Logic: Hide ORG001 for everyone except admin@permit.com
    if (user.email !== 'admin@permit.com') {
        const { data: seedOrg } = await supabase.from('organizers').select('id').eq('organizer_code', 'ORG001').maybeSingle()
        if (seedOrg) {
            query = query.neq('organizer_id', seedOrg.id)
        }
    }

    const { data: locations, error: locationsError } = await withTimeout(() => query, 5000, 'locations query')
    if (locationsError) {
        console.error('[fetchLocations] Error fetching locations:', locationsError)
        return []
    }
    if (!locations) return []

    // Fetch tenant counts for each location
    const locationsWithCounts = await Promise.all(
        locations.map(async (loc: any) => {
            try {
                // Try to get count - use a simpler query first
                const { count, error: countError } = await withTimeout(
                    () => supabase
                        .from('tenant_locations')
                        .select('*', { count: 'exact', head: true })
                        .eq('location_id', loc.id)
                        .eq('status', 'active'),
                    2000,
                    `count tenants for location ${loc.id}`
                )

                if (countError) {
                    console.warn(`[fetchLocations] Error counting tenants for location ${loc.id}:`, countError.message || countError)
                    return { ...loc, tenant_count: 0 }
                }

                return { ...loc, tenant_count: count || 0 }
            } catch (e: any) {
                // If count fails (e.g., timeout or RLS), return location with count 0
                console.warn(`[fetchLocations] Failed to count tenants for location ${loc.id}:`, e?.message || e)
                return { ...loc, tenant_count: 0 }
            }
        })
    )

    return locationsWithCounts
}

export async function fetchSettingsData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { profile: null, backups: [], role: null, trialPeriodDays: 14, user: null }

    const { data: userProfile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single()
    const role = userProfile?.role

    let profile: any = {
        profile_id: user.id,
        email: userProfile?.email || user.email,
        full_name: userProfile?.full_name || user.user_metadata?.full_name || '',
    }

    // Fetch role-specific profile data with timeouts
    try {
        if (role === 'organizer') {
            const { data: org } = await withTimeout(
                () => supabase.from('organizers').select('*').eq('profile_id', user.id).maybeSingle(),
                3000,
                'organizer profile'
            )
            if (org) {
                profile = { ...profile, ...org, id: org.id, business_name: org.name, organizer_code: org.organizer_code, status: org.status }
            }
        } else if (role === 'admin') {
            const { data: admin } = await withTimeout(
                () => supabase.from('admins').select('*').eq('profile_id', user.id).maybeSingle(),
                3000,
                'admin profile'
            )
            if (admin) {
                profile = {
                    ...profile,
                    id: admin.id,
                    // Use explicit business_name column if available, fallback to full_name for backward compatibility or if using as label
                    business_name: admin.business_name || admin.full_name,
                    organizer_code: admin.organizer_code,
                    phone_number: admin.phone_number,
                    address: admin.address,
                    ssm_number: admin.ssm_number,
                    bank_name: admin.bank_name,
                    bank_account_number: admin.bank_account_number,
                    bank_account_holder: admin.bank_account_holder
                }
            }
        } else if (role === 'staff') {
            const { data: staff } = await withTimeout(
                () => supabase.from('staff').select('*').eq('profile_id', user.id).maybeSingle(),
                3000,
                'staff profile'
            )
            if (staff) {
                profile = { ...profile, id: staff.id, business_name: staff.full_name, organizer_code: staff.organizer_code }
            }
        } else {
            const { data: tenant } = await withTimeout(
                () => supabase.from('tenants').select('*').eq('profile_id', user.id).maybeSingle(),
                3000,
                'tenant profile'
            )
            if (tenant) {
                profile = { ...profile, id: tenant.id, business_name: tenant.business_name || tenant.full_name }
            }
        }
    } catch (e) {
        console.error('[fetchSettingsData] Error fetching profile:', e)
    }

    let backups: any[] = []
    if (['admin', 'superadmin', 'staff'].includes(role || '')) {
        try {
            const { data: b } = await withTimeout(
                () => supabase.storage.from('backups').list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 10 }),
                3000,
                'backups list'
            )
            if (b) backups = b
        } catch (e) {
            console.error('[fetchSettingsData] Error fetching backups:', e)
        }
    }

    const { data: systemSettings } = await supabase.from('system_settings').select('trial_period_days').single()
    const trialPeriodDays = systemSettings?.trial_period_days || 14

    return { profile, backups, role, trialPeriodDays, user }
}
