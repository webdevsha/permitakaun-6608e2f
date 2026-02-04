'use server'

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function activateSubscription(params: {
    transactionId: string,
    planType: string,
    amount: number,
    paymentRef: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: "Unauthorized" }

    // 1. Get Tenant ID
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('profile_id', user.id)
        .single()

    if (!tenant) return { success: false, error: "Tenant not found" }

    // 2. Calculate Validity
    const now = new Date()
    const endDate = new Date()
    endDate.setDate(now.getDate() + 30) // Monthly subscription

    // 3. Insert Subscription
    const { error } = await supabase.from('subscriptions').insert({
        tenant_id: tenant.id,
        plan_type: params.planType,
        status: 'active',
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        amount: params.amount,
        payment_ref: params.paymentRef
    })

    if (error) {
        console.error("Subscription activation error:", error)
        return { success: false, error: "Gagal mengaktifkan langganan." }
    }

    // 4. Update tenant accounting_status to active
    const { error: tenantUpdateError } = await supabase
        .from('tenants')
        .update({ accounting_status: 'active' })
        .eq('id', tenant.id)

    if (tenantUpdateError) {
        console.error("Tenant status update error:", tenantUpdateError)
        // Don't fail the whole operation, but log it
    }

    // Revalidate all relevant paths
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/accounting')
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/subscription')

    return { success: true }
}

export async function checkSubscriptionStatus(tenantId: number) {
    const supabase = await createClient()

    const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('end_date', { ascending: false })
        .limit(1)
        .single() // use single() or maybeSingle() to get one

    return !!data
}
