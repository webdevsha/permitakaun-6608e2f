import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { unstable_cache } from 'next/cache'

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

// Cache the dashboard data for 30 seconds to reduce database load
const getCachedDashboardData = unstable_cache(
    async (userId: string, role: string, email: string, organizerCode: string | null) => {
        return await fetchDashboardDataInternal(userId, role, email, organizerCode)
    },
    ['dashboard-data'],
    { revalidate: 30, tags: ['dashboard'] }
)

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
        // --- ADMIN & SUPERADMIN (Organization Owners) ---
        if (role === 'admin' || role === 'superadmin' || email === 'admin@kumim.my') {
            const isDeveloperAdmin = email === 'admin@permit.com'
            const adminOrgCode = email === 'admin@kumim.my' ? 'ORG002' : null

            // Fetch Tenants with timeout
            try {
                let tQuery = supabase
                    .from('tenants')
                    .select('*, tenant_locations(*, locations(*))')
                    .order('created_at', { ascending: false })
                    .limit(100) // Limit to prevent timeouts

                // admin@kumim.my sees ALL tenants (no filter)
                // Other admins see tenants except ORG001 (seed data)
                if (!adminOrgCode && !isDeveloperAdmin) {
                    tQuery = tQuery.neq('organizer_code', 'ORG001')
                }

                const { data: t, error } = await withTimeout(() => tQuery, 5000, 'tenants query')

                if (error) throw error

                // Get organizer name map
                const { data: allOrganizers } = await withTimeout(
                    () => supabase.from('organizers').select('profile_id, organizer_code, name').limit(100),
                    3000,
                    'organizers query'
                )
                const validOrganizers = allOrganizers?.filter(o => o.organizer_code) || []
                const organizerNameMap = new Map(validOrganizers.map(o => [o.organizer_code, o.name]))

                tenants = (t || []).map(tenant => ({
                    ...tenant,
                    locations: tenant.tenant_locations?.map((l: any) => ({
                        name: l.locations?.name,
                        status: l.status // Include status for TenantList
                    })) || [],
                    organizerName: tenant.organizer_code ? (organizerNameMap.get(tenant.organizer_code) || tenant.organizer_code) : '-',
                    lastPaymentDate: "Tiada Rekod",
                    lastPaymentAmount: 0,
                    paymentStatus: 'active'
                }))
            } catch (e: any) {
                console.error('[Dashboard] Error fetching tenants:', e.message || e)
                tenants = []
            }

            // Fetch Transactions with timeout
            try {
                // admin@kumim.my and developer admin see ALL transactions across ALL organizers
                // This gives them full visibility into all financial data
                let txQuery = supabase
                    .from('organizer_transactions')
                    .select('*, tenants(full_name, business_name, organizer_code)')
                    .order('date', { ascending: false })
                    .limit(100) // Increased limit for admin view

                // Only filter out seed data for non-privileged admins
                if (!adminOrgCode && !isDeveloperAdmin) {
                    try {
                        const { data: seedOrg } = await supabase
                            .from('organizers')
                            .select('id')
                            .eq('organizer_code', 'ORG001')
                            .maybeSingle()
                        if (seedOrg) {
                            txQuery = txQuery.neq('organizer_id', seedOrg.id)
                        }
                    } catch (filterErr) {
                        console.warn('[Dashboard] Could not filter seed data:', filterErr)
                        // Continue without filter if it fails
                    }
                }

                const { data: tx, error } = await withTimeout(() => txQuery, 5000, 'organizer transactions query')
                if (error) {
                    console.error('[Dashboard] Transaction query error:', error)
                    throw error
                }

                transactions = (tx || []).map(t => ({
                    ...t,
                    table_source: 'organizer_transactions'
                }))

                console.log(`[Dashboard] Loaded ${transactions.length} transactions for admin`)
            } catch (e: any) {
                console.error('[Dashboard] Error fetching transactions:', e.message || e)
                transactions = []
            }

            // Also fetch admin transactions (Langganan payments) for admin view
            try {
                const { data: adminTx, error: adminError } = await withTimeout(
                    () => supabase
                        .from('admin_transactions')
                        .select('*')
                        .order('date', { ascending: false })
                        .limit(50),
                    5000,
                    'admin transactions query'
                )

                if (adminError) {
                    console.error('[Dashboard] Admin transactions error:', adminError)
                    throw adminError
                }

                // Add admin transactions (Langganan) to the transactions list
                const formattedAdminTx = (adminTx || []).map(t => ({
                    ...t,
                    table_source: 'admin_transactions',
                    // Ensure consistent structure with organizer_transactions
                    tenants: null
                }))

                // Combine and sort by date (newest first)
                const combinedCount = transactions.length + formattedAdminTx.length
                transactions = [...transactions, ...formattedAdminTx]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 100) // Keep top 100 after combining

                console.log(`[Dashboard] Combined ${combinedCount} total transactions (organizer: ${transactions.length - formattedAdminTx.length}, admin: ${formattedAdminTx.length})`)
            } catch (e) {
                console.error('[Dashboard] Error fetching admin transactions:', e)
                // Don't overwrite organizer transactions if admin fetch fails
            }

            // Fetch Organizers
            try {
                let orgQuery = supabase.from('organizers').select('*, locations(*)').order('created_at', { ascending: false })
                // admin@kumim.my (adminOrgCode exists) and developer admin see all organizers
                if (!adminOrgCode && !isDeveloperAdmin) {
                    orgQuery = orgQuery.not('organizer_code', 'in', '("ORG001","ORGKL01","ORGUD01")')
                }
                const { data: org, error } = await withTimeout(() => orgQuery.limit(50), 3000, 'organizers query')
                if (error) throw error
                organizers = org || []
            } catch (e) {
                console.error('[Dashboard] Error fetching organizers:', e)
                organizers = []
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
                                // Add link context
                                link_id: link.id,
                                link_status: link.status,
                                // Legacy compatibility (optional)
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
                    }
                }

                // Fetch tenants and transactions
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

    // For now, skip caching to avoid stale data issues
    // Return fresh data
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
            const { count, error: countError } = await supabase
                .from('tenant_locations')
                .select('*', { count: 'exact', head: true })
                .eq('location_id', loc.id)
                .eq('status', 'active')

            if (countError) {
                console.error(`[fetchLocations] Error counting tenants for location ${loc.id}:`, countError)
            }

            return { ...loc, tenant_count: count || 0 }
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
