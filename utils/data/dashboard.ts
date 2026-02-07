import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"
import { unstable_cache } from 'next/cache'

// Timeout wrapper to prevent infinite hangs
async function withTimeout<T>(
    queryFn: () => Promise<T>,
    ms: number,
    context: string
): Promise<T> {
    return Promise.race([
        queryFn(),
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
                const organizerNameMap = new Map(allOrganizers?.map(o => [o.organizer_code, o.name]) || [])

                tenants = (t || []).map(tenant => ({
                    ...tenant,
                    locations: tenant.tenant_locations?.map((l: any) => l.locations?.name) || [],
                    organizerName: organizerNameMap.get(tenant.organizer_code) || tenant.organizer_code || '-',
                    lastPaymentDate: "Tiada Rekod",
                    lastPaymentAmount: 0,
                    paymentStatus: 'active'
                }))
            } catch (e) {
                console.error('[Dashboard] Error fetching tenants:', e)
                tenants = []
            }

            // Fetch Transactions with timeout
            try {
                let txQuery = supabase
                    .from('organizer_transactions')
                    .select('*, tenants(full_name, business_name, organizer_code)')
                    .order('date', { ascending: false })
                    .limit(50) // Limit to prevent timeouts

                // admin@kumim.my sees ALL transactions (no filter)
                // Other admins see transactions except ORG001 (seed data)
                if (!adminOrgCode && !isDeveloperAdmin) {
                    const { data: seedOrg } = await supabase
                        .from('organizers')
                        .select('id')
                        .eq('organizer_code', 'ORG001')
                        .maybeSingle()
                    if (seedOrg) {
                        txQuery = txQuery.neq('organizer_id', seedOrg.id)
                    }
                }

                const { data: tx, error } = await withTimeout(() => txQuery, 5000, 'organizer transactions query')
                if (error) throw error
                
                transactions = (tx || []).map(t => ({
                    ...t,
                    table_source: 'organizer_transactions'
                }))
            } catch (e) {
                console.error('[Dashboard] Error fetching transactions:', e)
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
                
                if (adminError) throw adminError
                
                // Add admin transactions (Langganan) to the transactions list
                const formattedAdminTx = (adminTx || []).map(t => ({
                    ...t,
                    table_source: 'admin_transactions',
                    // Ensure consistent structure with organizer_transactions
                    tenants: null
                }))
                
                // Combine and sort by date (newest first)
                transactions = [...transactions, ...formattedAdminTx]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 50) // Keep only top 50 after combining
            } catch (e) {
                console.error('[Dashboard] Error fetching admin transactions:', e)
                // Don't overwrite organizer transactions if admin fetch fails
            }

            // Fetch Organizers
            try {
                let orgQuery = supabase.from('organizers').select('*, locations(*)').order('created_at', { ascending: false })
                if (!isDeveloperAdmin) {
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
            let orgId = null

            if (role === 'organizer') {
                const { data: org } = await withTimeout(
                    () => supabase.from('organizers').select('id, organizer_code').eq('profile_id', userId).single(),
                    3000,
                    'organizer lookup'
                )
                orgId = org?.id
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
        organizers,
        myLocations,
        availableLocations,
        userProfile,
        role
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

    // Return locations without counting (to save time)
    return locations.map((loc: any) => ({ ...loc, tenant_count: 0 }))
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
                profile = { ...profile, id: org.id, business_name: org.name, organizer_code: org.organizer_code, status: org.status }
            }
        } else if (role === 'admin') {
            const { data: admin } = await withTimeout(
                () => supabase.from('admins').select('*').eq('profile_id', user.id).maybeSingle(),
                3000,
                'admin profile'
            )
            if (admin) {
                profile = { ...profile, id: admin.id, business_name: admin.full_name, organizer_code: admin.organizer_code }
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
