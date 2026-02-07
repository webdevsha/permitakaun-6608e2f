import { createClient } from "@/utils/supabase/server"
import { determineUserRole } from "@/utils/roles"

// Timeout wrapper to prevent infinite hangs
async function withTimeout<T>(
    queryFn: () => any,
    ms: number,
    context: string
): Promise<T> {
    return Promise.race([
        Promise.resolve(queryFn()),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout: ${context} took longer than ${ms}ms`)), ms)
        )
    ])
}

export async function fetchDashboardData() {
    const supabase = await createClient()

    // Get User Role Context (with timeout to prevent infinite hang)
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

    if (!user) return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role: null, userProfile: null }

    const { data: profile } = await supabase.from('profiles').select('role, organizer_code, full_name, email').eq('id', user.id).single()

    // Use shared role determination logic for consistency
    const role = determineUserRole(profile, user.email)

    // Get organizer_code from appropriate table based on role
    let organizerCode = profile?.organizer_code

    // For staff, get organizer_code from staff table (mirrors admin's data)
    if (role === 'staff') {
        const { data: staffData } = await supabase.from('staff').select('organizer_code').eq('profile_id', user.id).single()
        if (staffData?.organizer_code) {
            organizerCode = staffData.organizer_code
        }
    }
    // For admin, get organizer_code from admins table
    else if (role === 'admin') {
        const { data: adminData } = await supabase.from('admins').select('organizer_code').eq('profile_id', user.id).single()
        if (adminData?.organizer_code) {
            organizerCode = adminData.organizer_code
        }
    }

    // Set userProfile with basic info from profiles table
    let userProfile: any = profile ? {
        full_name: profile.full_name,
        email: profile.email
    } : null

    let tenants: any[] = []
    let transactions: any[] = []
    let organizers: any[] = []
    let myLocations: any[] = []
    let availableLocations: any[] = []

    // --- ADMIN & SUPERADMIN (Organization Owners) ---
    // Only fetch ALL if explicitly Admin/Superadmin. Staff handled separately to enforce mirroring.
    if (role === 'admin' || role === 'superadmin' || user.email === 'admin@kumim.my') {

        // Developer-Admin Logic: Only admin@permit.com sees Seed Data (ORG001)
        const isDeveloperAdmin = user.email === 'admin@permit.com'

        // Specific admin organization codes - these admins ONLY see their own org data
        const adminOrgCode = user.email === 'admin@kumim.my' ? 'ORG002' : null

        // Fetch Tenants with Locations
        // IMPORTANT: Exclude organizers and admins - they are NOT tenants
        let tQuery = supabase
            .from('tenants')
            .select('*, tenant_locations(*, locations(*))')
            .order('created_at', { ascending: false })

        if (adminOrgCode) {
            // Specific admin (e.g., admin@kumim.my) only sees their org data
            tQuery = tQuery.eq('organizer_code', adminOrgCode)
        } else if (!isDeveloperAdmin) {
            // Other non-dev admins exclude ORG001 but see all other orgs
            tQuery = tQuery.neq('organizer_code', 'ORG001')
        }

        const { data: t } = await tQuery

        // Filter out organizers and admins from tenants list
        // They should NOT appear under "Peniaga & Sewa"
        const { data: allOrganizers } = await supabase.from('organizers').select('profile_id, organizer_code, name')
        const organizerProfileIds = new Set(allOrganizers?.map(o => o.profile_id).filter(Boolean) || [])
        const organizerCodes = new Set(allOrganizers?.map(o => o.organizer_code).filter(Boolean) || [])
        // Create a map of organizer_code to name
        const organizerNameMap = new Map(allOrganizers?.map(o => [o.organizer_code, o.name]) || [])

        // Also get admin/staff profiles to exclude
        const { data: adminProfiles } = await supabase.from('profiles').select('id').in('role', ['admin', 'superadmin', 'staff'])
        const adminProfileIds = new Set(adminProfiles?.map(p => p.id) || [])

        // Enrich Tenants with Payment Status (Server-side simulation of client logic)
        if (t) {
            // Fetch last approved payments for all tenants efficiently
            const { data: payments } = await supabase
                .from('tenant_payments')
                .select('*')
                .eq('status', 'approved')
                .order('payment_date', { ascending: false })

            // Filter tenants: exclude organizers, admins, and staff
            // They should NOT appear under "Peniaga & Sewa"
            let filteredTenants = t.filter(tenant => {
                // Exclude if profile is an organizer
                if (tenant.profile_id && organizerProfileIds.has(tenant.profile_id)) return false
                // Exclude if profile is admin/staff
                if (tenant.profile_id && adminProfileIds.has(tenant.profile_id)) return false
                return true
            })

            // For admin@kumim.my: Only show "Ahmad" as sample (hide others for demo purposes)
            if (user.email === 'admin@kumim.my') {
                filteredTenants = filteredTenants.filter(tenant =>
                    tenant.full_name?.toLowerCase().includes('ahmad') ||
                    tenant.full_name?.toLowerCase().includes('sample')
                )
            }

            tenants = filteredTenants.map(tenant => {
                const lastPayment = payments?.find((p: any) => p.tenant_id === tenant.id)
                let paymentStatus = 'active'
                if (!lastPayment) paymentStatus = 'new'
                return {
                    ...tenant,
                    locations: tenant.tenant_locations?.map((l: any) => l.locations?.name) || [],
                    organizerName: organizerNameMap.get(tenant.organizer_code) || tenant.organizer_code || '-',
                    lastPaymentDate: lastPayment?.payment_date
                        ? new Date(lastPayment.payment_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                        : "Tiada Rekod",
                    lastPaymentAmount: lastPayment?.amount || 0,
                    paymentStatus
                }
            })
        }


        let txQuery = supabase
            .from('transactions')
            .select('*, tenants!inner(full_name, business_name, organizer_code)')
            .order('date', { ascending: false })

        if (adminOrgCode) {
            // Specific admin only sees their org transactions
            txQuery = txQuery.eq('tenants.organizer_code', adminOrgCode)
        } else if (!isDeveloperAdmin) {
            // Need to filter transactions where tenant's organizer_code is NOT ORG001
            // The !inner join on tenants allows filtering by tenant fields
            txQuery = txQuery.neq('tenants.organizer_code', 'ORG001')
        }

        const { data: tx } = await txQuery
        transactions = tx || []

        let orgQuery = supabase.from('organizers').select('*, locations(*)').order('created_at', { ascending: false })
        if (!isDeveloperAdmin) {
            // Filter out ALL seed/demo organizer codes for non-dev admins
            orgQuery = orgQuery.not('organizer_code', 'in', '("ORG001","ORGKL01","ORGUD01")')
        }
        const { data: org } = await orgQuery
        organizers = org || []

        // --- ORGANIZER ROLE (Self) OR STAFF (Mirrored Admin View) ---
    } else if (role === 'organizer' || role === 'staff') {
        // Enforce STRICT mirroring: Staff MUST have an organizer_code.
        // If staff has no code, they see NOTHING.
        let orgCode = organizerCode
        let orgId = null

        if (role === 'organizer') {
            // Organizer table uses 'profile_id' as the FK to auth.users
            console.log(`[Dashboard] Organizer lookup: user.id=${user.id}`)
            const { data: org, error: orgError } = await supabase.from('organizers').select('id, organizer_code').eq('profile_id', user.id).single()
            console.log(`[Dashboard] Organizer result:`, org, 'error:', orgError)
            orgCode = org?.organizer_code
            orgId = org?.id

            if (org) {
                organizers = [org] // Populate for UI Header
            }
        } else if (role === 'staff') {
            console.log(`[Dashboard] Staff access: orgCode=${orgCode}`)
            if (!orgCode) {
                // If staff has no link, RETURN EMPTY to prevent leak
                console.warn(`[Dashboard] Staff has no organizer_code - returning empty`)
                return { transactions: [], tenants: [], overdueTenants: [], organizers: [], myLocations: [], availableLocations: [], role, userProfile }
            }

            // Staff: Find the organizer by code to get their ID (Mirroring Admin's Org)
            const { data: org, error: orgError } = await supabase.from('organizers').select('id, organizer_code').eq('organizer_code', orgCode).single()
            console.log(`[Dashboard] Staff organizer lookup:`, org, 'error:', orgError)
            orgId = org?.id

            if (org) {
                organizers = [org] // Populate for UI Header
            }
        }

        // Fetch Locations (for both Organizer and Staff)
        if (orgId) {
            const { data: locs } = await supabase
                .from('locations')
                .select('*')
                .eq('organizer_id', orgId)
                .order('name')

            if (locs) {
                myLocations = locs.map((l: any) => ({
                    location_name: l.name,
                    display_price: l.rate_monthly || l.rate_khemah || 0, // Fallback price for display
                    ...l
                }))
            }
        }

        // Combine logic: Fetch tenants by Code OR by Location Rental
        if (orgCode || (myLocations && myLocations.length > 0)) {
            console.log(`[Dashboard DEBUG] Discovery Start. OrgCode: ${orgCode}, Locs: ${myLocations?.length}`)
            let tenantIds = new Set<string>();

            // 1. Get Tenants by Organizer Code
            if (orgCode) {
                const { data: tByCode, error: tErr } = await supabase
                    .from('tenants')
                    .select('id')
                    .eq('organizer_code', orgCode)
                if (tErr) console.error('[Dashboard DEBUG] Error fetching tenants by code:', tErr)
                tByCode?.forEach(x => tenantIds.add(x.id))
                console.log(`[Dashboard DEBUG] Tenants by Code: ${tByCode?.length || 0}`)
            }

            // 2. Get Tenants by Location Rentals
            // (Even if they don't have my organizer_code, they are my tenants if they rent my spot)
            if (myLocations && myLocations.length > 0) {
                const locIds = myLocations.map((l: any) => l.id)
                console.log(`[Dashboard DEBUG] Checking rentals for Location IDs:`, locIds)
                const { data: rentalTenants, error: rErr } = await supabase
                    .from('tenant_locations')
                    .select('tenant_id')
                    .in('location_id', locIds)
                    .eq('status', 'active')

                if (rErr) console.error('[Dashboard DEBUG] Error fetching rental tenants:', rErr)
                rentalTenants?.forEach(r => tenantIds.add(r.tenant_id))
                console.log(`[Dashboard DEBUG] Tenants by Rentals: ${rentalTenants?.length || 0}`)
            }

            console.log(`[Dashboard DEBUG] Total Tenant IDs:`, Array.from(tenantIds))

            // Fetch Full Data for these Tenants
            if (tenantIds.size > 0) {
                const tIds = Array.from(tenantIds) as string[]

                const { data: t } = await supabase
                    .from('tenants')
                    .select('*, tenant_locations(*, locations(*))')
                    .in('id', tIds)
                    .order('full_name', { ascending: true })

                // Enrich Tenants
                if (t) {
                    const { data: payments } = await supabase
                        .from('tenant_payments')
                        .select('*')
                        .eq('status', 'approved')
                        .in('tenant_id', tIds)
                        .order('payment_date', { ascending: false })

                    // Filter out organizers/admins from tenants
                    const { data: allOrganizers } = await supabase.from('organizers').select('profile_id, organizer_code, name')
                    const organizerProfileIds = new Set(allOrganizers?.map(o => o.profile_id).filter(Boolean) || [])
                    const organizerCodes = new Set(allOrganizers?.map(o => o.organizer_code).filter(Boolean) || [])
                    // Create a map of organizer_code to name
                    const organizerNameMap = new Map(allOrganizers?.map(o => [o.organizer_code, o.name]) || [])
                    // Get admin/staff IDs from new tables
                    const { data: adminData } = await supabase.from('admins').select('profile_id')
                    const { data: staffData } = await supabase.from('staff').select('profile_id')
                    const adminProfileIds = new Set([
                        ...(adminData?.map(a => a.profile_id) || []),
                        ...(staffData?.map(s => s.profile_id) || [])
                    ])

                    console.log(`[Dashboard DEBUG] Before filter: ${t.length} tenants`)
                    console.log(`[Dashboard DEBUG] Organizer profile IDs:`, Array.from(organizerProfileIds))
                    console.log(`[Dashboard DEBUG] Admin/Staff profile IDs:`, Array.from(adminProfileIds))
                    tenants = t
                        .filter(tenant => {
                            // Filter out records where a profile is an organizer (not a tenant)
                            if (tenant.profile_id && organizerProfileIds.has(tenant.profile_id)) {
                                console.log(`[Dashboard DEBUG] Filtered out ${tenant.full_name} - matches organizer profile`)
                                return false
                            }
                            // Filter out records where a profile is admin/staff (not a tenant)
                            if (tenant.profile_id && adminProfileIds.has(tenant.profile_id)) {
                                console.log(`[Dashboard DEBUG] Filtered out ${tenant.full_name} - matches admin/staff profile`)
                                return false
                            }
                            return true
                        })
                        .map(tenant => {
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
                                paymentStatus,
                                organizerName: tenant.organizer_code || '-'
                            }
                        })
                }

                // Fetch Transactions for these tenants
                // For Staff/Organizers: Show ALL transactions (Sewa and others) for full visibility
                console.log(`[Dashboard DEBUG] Fetching transactions for IDs:`, tIds)
                const { data: tx, error: txErr } = await supabase
                    .from('transactions')
                    .select('*, tenants(full_name, business_name)')
                    .in('tenant_id', tIds)
                    .order('date', { ascending: false })

                if (txErr) console.error('[Dashboard DEBUG] Transaction Fetch Error:', txErr)
                console.log(`[Dashboard DEBUG] Transactions Found: ${tx?.length || 0}`)

                // Also fetch the organizer's OWN manual transactions (their personal Cash In/Out)
                const { data: ownTx } = await supabase
                    .from('transactions')
                    .select('*, tenants(full_name, business_name)')
                    .in('tenant_id', tenants.filter((t: any) => t.profile_id === user.id).map((t: any) => t.id))
                    .order('date', { ascending: false })

                // Fetch PUBLIC PAYMENTS (payments from non-registered users via /bayar)
                // These have organizer_id set but no tenant_id
                const { data: publicTx, error: publicTxErr } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('organizer_id', orgId)
                    .is('tenant_id', null)
                    .order('date', { ascending: false })

                if (publicTxErr) console.error('[Dashboard DEBUG] Public Payment Fetch Error:', publicTxErr)
                console.log(`[Dashboard DEBUG] Public Payments Found: ${publicTx?.length || 0}`)

                // Combine: Rent from managed tenants + Own manual transactions + Public payments
                transactions = [...(tx || []), ...(ownTx || []), ...(publicTx || [])]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

            } else {
                transactions = []
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

            // If we found a tenant by email but it doesn't have profile_id linked,
            // we should link it now to prevent future mismatches
            if (tenantByEmail && !tenantByEmail.profile_id) {
                const { error: updateError } = await supabase
                    .from('tenants')
                    .update({ profile_id: user.id })
                    .eq('id', tenantByEmail.id)

                if (!updateError) {
                    // Successfully linked, update our local copy
                    currentTenant = { ...tenantByEmail, profile_id: user.id }
                } else {
                    // If update failed, still use the tenant but log the issue
                    console.warn('Failed to link tenant profile_id:', updateError)
                    currentTenant = tenantByEmail
                }
            } else {
                currentTenant = tenantByEmail
            }
        }

        if (currentTenant) {
            tenants = [currentTenant] // Fix: Populate tenants array so AccountingModule can identify viewer
            userProfile = currentTenant

            // 2. Get My Locations
            const { data: locData } = await supabase
                .from('tenant_locations')
                .select(`*, locations:location_id (*)`)
                .eq('tenant_id', currentTenant.id)

            if (locData) {
                myLocations = locData.map((item: any) => {
                    let price = 0
                    const loc = item.locations

                    // Try to get price based on rate_type
                    if (item.rate_type === 'khemah' && loc.rate_khemah > 0) {
                        price = loc.rate_khemah
                    } else if (item.rate_type === 'cbs' && loc.rate_cbs > 0) {
                        price = loc.rate_cbs
                    } else if (item.rate_type === 'monthly' && loc.rate_monthly > 0) {
                        price = loc.rate_monthly
                    } else {
                        // Fallback: Use any available rate (prefer monthly > khemah > cbs)
                        price = (loc.rate_monthly > 0 ? loc.rate_monthly : 0) ||
                            (loc.rate_khemah > 0 ? loc.rate_khemah : 0) ||
                            (loc.rate_cbs > 0 ? loc.rate_cbs : 0) || 0
                    }

                    return {
                        ...item,
                        display_price: price,
                        location_name: loc.name
                    }
                })
            }

            // 3. Get History
            const { data: txData } = await supabase
                .from('transactions')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .neq('category', 'Langganan') // Exclude system subscriptions
                .neq('category', 'Subscription')
                .order('date', { ascending: false })

            if (txData) {
                transactions = txData.map(tx => ({
                    id: tx.id,
                    date: tx.date, // Fix: Use 'date' instead of 'payment_date'
                    description: tx.description, // Fix: Use 'description' instead of 'remarks'
                    category: tx.category, // Pass category
                    amount: tx.amount,
                    type: tx.type, // Pass type (income/expense)
                    status: tx.status,
                    receipt_url: tx.receipt_url,
                    tenant_id: tx.tenant_id
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
        role,
        user // Added user for context (created_at etc)
    }
}

export async function fetchLocations() {
    const supabase = await createClient()

    // Get user with timeout protection
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

    // Regular organizers only see their own locations
    // Admin organizers (like admin@kumim.my) see ALL locations
    if (role === 'organizer' && user.email !== 'admin@kumim.my') {
        const { data: org } = await supabase.from('organizers').select('id').eq('profile_id', user.id).single()
        if (org) {
            query = query.eq('organizer_id', org.id)
        } else {
            return []
        }
    }
    // Admins, staff, and admin organizers see all locations (no filter)

    // Developer-Admin Logic: Hide ORG001 for everyone except admin@permit.com
    if (user.email !== 'admin@permit.com') {
        // Get ORG001 ID to exclude
        const { data: seedOrg } = await supabase.from('organizers').select('id').eq('organizer_code', 'ORG001').maybeSingle()
        if (seedOrg) {
            query = query.neq('organizer_id', seedOrg.id)
        }
    }

    const { data: locations, error: locationsError } = await query
    if (locationsError) {
        console.error('[fetchLocations] Error fetching locations:', locationsError)
        return []
    }
    if (!locations) return []

    // Optimized: Fetch all tenant counts in parallel with error handling
    const locationsWithCounts = await Promise.all(locations.map(async (loc: any) => {
        try {
            const { count, error: countError } = await supabase
                .from('tenant_locations')
                .select('*', { count: 'exact', head: true })
                .eq('location_id', loc.id)

            if (countError) {
                console.error(`[fetchLocations] Error counting tenants for location ${loc.id}:`, countError)
                return { ...loc, tenant_count: 0 }
            }
            return { ...loc, tenant_count: count || 0 }
        } catch (e) {
            console.error(`[fetchLocations] Exception counting tenants for location ${loc.id}:`, e)
            return { ...loc, tenant_count: 0 }
        }
    }))

    return locationsWithCounts
}

export async function fetchSettingsData() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { profile: null, backups: [], role: null, trialPeriodDays: 14, user: null }

    const { data: userProfile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single()
    const role = userProfile?.role

    let profile: any = {
        // Base data from auth/profiles
        profile_id: user.id,
        email: userProfile?.email || user.email,
        full_name: userProfile?.full_name || user.user_metadata?.full_name || '',
    }

    // Fetch role-specific profile data
    if (role === 'organizer') {
        // For organizers, fetch from organizers table
        const { data: org } = await supabase.from('organizers').select('*').eq('profile_id', user.id).maybeSingle()
        if (org) {
            profile = {
                ...profile,
                id: org.id,
                business_name: org.name,  // Organizer name = business name
                organizer_code: org.organizer_code,
                status: org.status,
                accounting_status: org.accounting_status,
                phone_number: org.phone,
                address: org.address,
                is_organizer: true,
            }
        }
    } else if (role === 'admin') {
        // For admins, fetch from admins table
        const { data: admin } = await supabase.from('admins').select('*').eq('profile_id', user.id).maybeSingle()
        if (admin) {
            profile = {
                ...profile,
                id: admin.id,
                business_name: admin.full_name,  // Use full name as business name for admins
                organizer_code: admin.organizer_code,
                status: admin.is_active ? 'active' : 'inactive',
                phone_number: admin.phone_number,
                is_admin: true,
            }
        }
    } else if (role === 'staff') {
        // For staff, fetch from staff table
        const { data: staff } = await supabase.from('staff').select('*').eq('profile_id', user.id).maybeSingle()
        if (staff) {
            profile = {
                ...profile,
                id: staff.id,
                business_name: staff.full_name,  // Use full name as business name for staff
                organizer_code: staff.organizer_code,
                status: staff.is_active ? 'active' : 'inactive',
                phone_number: staff.phone_number,
                is_staff: true,
            }
        }
    } else {
        // For tenants and others, fetch from tenants table
        const { data: tenant } = await supabase.from('tenants').select('*').eq('profile_id', user.id).maybeSingle()
        if (tenant) {
            profile = {
                ...profile,
                id: tenant.id,
                business_name: tenant.business_name || tenant.full_name,
                full_name: tenant.full_name || profile.full_name,
                phone_number: tenant.phone_number,
                ic_number: tenant.ic_number,
                ssm_number: tenant.ssm_number,
                address: tenant.address,
                status: tenant.status,
                accounting_status: tenant.accounting_status,
                profile_image_url: tenant.profile_image_url,
                ssm_file_url: tenant.ssm_file_url,
                food_handling_cert_url: tenant.food_handling_cert_url,
                other_docs_url: tenant.other_docs_url,
            }
        }
    }

    let backups: any[] = []
    if (['admin', 'superadmin', 'staff'].includes(role || '')) {
        const { data: b } = await supabase.storage.from('backups').list('', { sortBy: { column: 'created_at', order: 'desc' } })
        if (b) backups = b
    }

    const { data: systemSettings } = await supabase.from('system_settings').select('trial_period_days').single()
    const trialPeriodDays = systemSettings?.trial_period_days || 14

    return { profile, backups, role, trialPeriodDays, user }
}
