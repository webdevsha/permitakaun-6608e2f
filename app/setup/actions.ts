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

        // 2. Perform filtered deletion
        // Delete tenant_locations first (dependency)
        let q1 = supabase.from('tenant_locations').delete()
        if (keepTenantIds.length > 0) q1 = q1.not('tenant_id', 'in', `(${keepTenantIds.join(',')})`)
        if (keepLocationIds.length > 0) q1 = q1.not('location_id', 'in', `(${keepLocationIds.join(',')})`)
        const { data: d1, error: e1 } = await q1.neq('id', 0).select()
        if (e1) throw new Error(`Error deleting rentals: ${e1.message}`)

        // Delete tenants
        let q2 = supabase.from('tenants').delete()
        if (keepTenantIds.length > 0) q2 = q2.not('id', 'in', `(${keepTenantIds.join(',')})`)
        const { data: d2, error: e2 } = await q2.neq('id', 0).select()
        if (e2) throw new Error(`Error deleting tenants: ${e2.message}`)

        // Delete locations
        let q3 = supabase.from('locations').delete()
        if (keepLocationIds.length > 0) q3 = q3.not('id', 'in', `(${keepLocationIds.join(',')})`)
        const { data: d3, error: e3 } = await q3.neq('id', 0).select()
        if (e3) throw new Error(`Error deleting locations: ${e3.message}`)

        // Delete organizers
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

