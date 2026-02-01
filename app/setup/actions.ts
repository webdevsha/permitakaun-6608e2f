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

        // Delete in order of dependencies and count
        const { data: d1, error: e1 } = await supabase.from('tenant_locations').delete().neq('id', 0).select()
        if (e1) throw new Error(`Error deleting rentals: ${e1.message}`)

        const { data: d2, error: e2 } = await supabase.from('tenants').delete().neq('id', 0).select()
        if (e2) throw new Error(`Error deleting tenants: ${e2.message}`)

        const { data: d3, error: e3 } = await supabase.from('locations').delete().neq('id', 0).select()
        if (e3) throw new Error(`Error deleting locations: ${e3.message}`)

        const { data: d4, error: e4 } = await supabase.from('organizers').delete().neq('id', '00000000-0000-0000-0000-000000000000').select()
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

