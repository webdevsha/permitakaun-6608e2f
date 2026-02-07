"use server"

import { createClient } from "@/utils/supabase/server"
import { sendAccountActivatedAction } from "@/actions/email"
import { revalidatePath } from "next/cache"

export async function toggleAccountingStatusAction(tenantId: number, newStatus: string) {
    const supabase = await createClient()

    try {
        // 1. Update Status
        const { error } = await supabase
            .from('tenants')
            .update({ accounting_status: newStatus })
            .eq('id', tenantId)

        if (error) throw error

        // 2. Send Email if Activating
        if (newStatus === 'active') {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('email, full_name')
                .eq('id', tenantId)
                .single()

            if (tenant && tenant.email) {
                await sendAccountActivatedAction(tenant.email, tenant.full_name)
            }
        }

        revalidatePath('/dashboard/tenants') // Adjust path as needed
        return { success: true }
    } catch (error: any) {
        console.error("Error toggling accounting status:", error)
        return { success: false, error: error.message }
    }
}
