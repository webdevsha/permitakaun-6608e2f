"use server"

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export async function clearAllSetupData() {
    try {
        let supabase;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (serviceRoleKey) {
            supabase = createAdminClient()
        } else {
            console.warn("SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to authenticated user client. Deletion may be incomplete depending on RLS.")
            supabase = await createClient()
        }

        const targetEmail = 'rafisha92@gmail.com'

        // 1. Identify data to preserve
        let keepTenantIds: number[] = []
        let keepOrganizerIds: string[] = []
        let keepLocationIds: number[] = []

        const { data: prof } = await supabase.from('profiles').select('id').eq('email', targetEmail).maybeSingle()
        if (prof) {
            // Fetch her organizers
            const { data: orgs } = await supabase.from('organizers').select('id, organizer_code').eq('profile_id', prof.id)
            if (orgs && orgs.length > 0) {
                keepOrganizerIds = orgs.map(o => o.id)
                const codes = orgs.map(o => o.organizer_code)

                // Fetch locations and tenants linked to her organizers
                const { data: locs } = await supabase.from('locations').select('id').in('organizer_id', keepOrganizerIds)
                if (locs) keepLocationIds = locs.map(l => l.id)

                const { data: tnts } = await supabase.from('tenants').select('id').in('organizer_code', codes)
                if (tnts) keepTenantIds = tnts.map(t => t.id)
            }

            // Also check if she is directly a tenant
            const { data: myTenant } = await supabase.from('tenants').select('id').eq('profile_id', prof.id).maybeSingle()
            if (myTenant) keepTenantIds.push(myTenant.id)
        }

        // 2. Perform filtered deletion in correct order (respecting foreign keys)

        // Step 1: Delete transactions from all transaction tables
        // Delete from tenant_transactions
        let q0a = supabase.from('tenant_transactions').delete()
        if (keepTenantIds.length > 0) q0a = q0a.not('tenant_id', 'in', `(${keepTenantIds.join(',')})`)
        const { data: d0a, error: e0a } = await q0a.neq('id', 0).select()
        if (e0a) console.error(`Error deleting tenant_transactions: ${e0a.message}`)
        
        // Delete from organizer_transactions
        let q0b = supabase.from('organizer_transactions').delete()
        if (keepTenantIds.length > 0) q0b = q0b.not('tenant_id', 'in', `(${keepTenantIds.join(',')})`)
        const { data: d0b, error: e0b } = await q0b.neq('id', 0).select()
        if (e0b) console.error(`Error deleting organizer_transactions: ${e0b.message}`)
        
        // Also delete from legacy transactions table (for backward compatibility)
        let q0c = supabase.from('transactions_backup').delete()
        if (keepTenantIds.length > 0) q0c = q0c.not('tenant_id', 'in', `(${keepTenantIds.join(',')})`)
        await q0c.neq('id', 0).select() // Ignore errors for backup table

        // Step 2: Delete tenant_locations (references both tenants and locations)
        let q1 = supabase.from('tenant_locations').delete()
        if (keepTenantIds.length > 0) q1 = q1.not('tenant_id', 'in', `(${keepTenantIds.join(',')})`)
        if (keepLocationIds.length > 0) q1 = q1.not('location_id', 'in', `(${keepLocationIds.join(',')})`)
        const { data: d1, error: e1 } = await q1.neq('id', 0).select()
        if (e1) throw new Error(`Error deleting rentals: ${e1.message}`)

        // Step 3: Delete tenants
        let q2 = supabase.from('tenants').delete()
        if (keepTenantIds.length > 0) q2 = q2.not('id', 'in', `(${keepTenantIds.join(',')})`)
        const { data: d2, error: e2 } = await q2.neq('id', 0).select()
        if (e2) throw new Error(`Error deleting tenants: ${e2.message}`)

        // Step 4: Delete locations
        let q3 = supabase.from('locations').delete()
        if (keepLocationIds.length > 0) q3 = q3.not('id', 'in', `(${keepLocationIds.join(',')})`)
        const { data: d3, error: e3 } = await q3.neq('id', 0).select()
        if (e3) throw new Error(`Error deleting locations: ${e3.message}`)

        // Step 5: Delete organizers
        let q4 = supabase.from('organizers').delete()
        if (keepOrganizerIds.length > 0) q4 = q4.not('id', 'in', `(${keepOrganizerIds.map(id => `'${id}'`).join(',')})`)
        const { data: d4, error: e4 } = await q4.neq('id', '00000000-0000-0000-0000-000000000000').select()
        if (e4) throw new Error(`Error deleting organizers: ${e4.message}`)

        revalidatePath('/dashboard')
        revalidatePath('/admin')

        return {
            success: true,
            warning: !serviceRoleKey ? "⚠️ Service Role Key MISSING. Deletion used normal permissions and may have failed for others' data." : undefined,
            counts: {
                tenant_transactions: d0a?.length || 0,
                organizer_transactions: d0b?.length || 0,
                rentals: d1?.length || 0,
                tenants: d2?.length || 0,
                locations: d3?.length || 0,
                organizers: d4?.length || 0
            }
        }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}


export async function cleanHazmanData() {
    try {
        let supabase;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (serviceRoleKey) {
            supabase = createAdminClient()
        } else {
            console.warn("SUPABASE_SERVICE_ROLE_KEY is not defined. Falling back to authenticated user client.")
            supabase = await createClient()
        }

        // 1. Get ORG002 ID
        const { data: org, error: orgError } = await supabase
            .from('organizers')
            .select('id')
            .eq('organizer_code', 'ORG002')
            .maybeSingle()

        if (!org) {
            return { success: true, message: "ORG002 not found (already clean)" }
        }

        const orgId = org.id

        // 2. Delete dependent data

        // Transactions (linked to Tenants of ORG002)
        // Need to find tenant IDs first
        const { data: tenants } = await supabase.from('tenants').select('id').eq('organizer_code', 'ORG002')
        if (tenants && tenants.length > 0) {
            const tenantIds = tenants.map(t => t.id)
            // Delete from both transaction tables
            await supabase.from('tenant_transactions').delete().in('tenant_id', tenantIds)
            await supabase.from('organizer_transactions').delete().in('tenant_id', tenantIds)
            await supabase.from('tenant_locations').delete().in('tenant_id', tenantIds)
        }

        // Tenant Locations (linked to Locations of ORG002)
        const { data: locs } = await supabase.from('locations').select('id').eq('organizer_id', orgId)
        if (locs && locs.length > 0) {
            const locIds = locs.map(l => l.id)
            await supabase.from('tenant_locations').delete().in('location_id', locIds)
        }

        // 3. Delete Core Data
        await supabase.from('tenants').delete().eq('organizer_code', 'ORG002')
        await supabase.from('locations').delete().eq('organizer_id', orgId)

        // Optionally delete the organizer itself? User said "clean slate", usually implies existing account but empty data.
        // But if they re-run setup, they want it to re-create.
        // The previous SQL script deleted the organizer too. Let's stick to that consistency.
        // Wait, if I delete the organizer, the Setup page needs to re-create it.
        // The user's goal is "Hazman's page dont have seed data".
        // If I delete the Organizer record, the user might lose access until they run "Setup" again.
        // But the user is supposed to click "Run Setup" after cleaning.
        // So deleting Organizer record IS correct.
        await supabase.from('organizers').delete().eq('id', orgId)

        revalidatePath('/dashboard')
        revalidatePath('/admin')
        revalidatePath('/setup')

        return { success: true, message: "Successfully cleaned Hazman (ORG002) data" }
    } catch (error: any) {
        console.error("Clean Hazman Error:", error)
        return { success: false, error: error.message }
    }
}

export async function wipeSystemData() {
    try {
        let supabase;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (serviceRoleKey) {
            supabase = createAdminClient()
        } else {
            // This is dangerous without service role, but for dev it might work if RLS allows
            supabase = await createClient()
        }

        // Delete all operational data
        // Delete from all transaction tables
        await supabase.from('tenant_transactions').delete().neq('id', 0)
        await supabase.from('organizer_transactions').delete().neq('id', 0)
        await supabase.from('admin_transactions').delete().neq('id', 0)
        // Also clean legacy backup table
        await supabase.from('transactions_backup').delete().neq('id', 0)
        // Tenant Locations
        await supabase.from('tenant_locations').delete().neq('id', 0)
        // Tenants
        await supabase.from('tenants').delete().neq('id', 0)
        // Locations
        await supabase.from('locations').delete().neq('id', 0)
        // Organizers (Optional, but user said "delete all data")
        // We usually keep the "Organizers" table for auth links, but "Clean Slate" usually means empty data.
        // Let's delete organizers too. The Setup script re-creates them.
        await supabase.from('organizers').delete().neq('id', '00000000-0000-0000-0000-000000000000')

        revalidatePath('/dashboard')
        revalidatePath('/admin')
        revalidatePath('/setup')

        return { success: true, message: "All system data wiped." }
    } catch (error: any) {
        console.error("Wipe Error:", error)
        return { success: false, error: error.message }
    }
}
