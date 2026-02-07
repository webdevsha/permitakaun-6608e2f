'use server'

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
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

// Submit manual subscription payment (server action to handle admin transactions)
export async function submitManualSubscriptionPayment(params: {
    planName: string
    price: string
    transactionId: string
    bankName: string
    notes: string
    receiptUrl: string | null
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { success: false, error: "Sesi tamat. Sila log masuk semula." }
    }

    const { planName, price, transactionId, bankName, notes, receiptUrl } = params
    const amount = parseFloat(price)

    try {
        console.log("[Server Action] Processing manual subscription payment:", {
            userId: user.id,
            email: user.email,
            planName,
            amount
        })

        // Get user role and tenant/organizer info
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const userRole = profile?.role
        console.log("[Server Action] User role:", userRole)

        if (!userRole || (userRole !== 'tenant' && userRole !== 'organizer')) {
            return { success: false, error: `Peranan tidak sah: ${userRole}` }
        }

        // 1. Create expense transaction for tenant/organizer (Cash Out)
        const expenseData = {
            description: `Bayaran Langganan - ${planName}`,
            amount: amount,
            type: 'expense',
            category: 'Langganan',
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            payment_method: 'bank_transfer',
            payment_reference: transactionId,
            receipt_url: receiptUrl,
            notes: `Bank: ${bankName}${notes ? ` | Catatan: ${notes}` : ''}`,
            metadata: {
                plan_type: planName.toLowerCase(),
                bank_name: bankName,
                transaction_id: transactionId,
                is_subscription: true,
                user_id: user.id,
                user_email: user.email,
                submitted_at: new Date().toISOString()
            }
        }

        let expenseResult
        if (userRole === 'tenant') {
            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('id')
                .eq('profile_id', user.id)
                .single()

            if (tenantError || !tenant) {
                console.error("[Server Action] Tenant not found:", tenantError)
                return { success: false, error: "Rekod peniaga tidak dijumpai" }
            }

            expenseResult = await supabase
                .from('tenant_transactions')
                .insert({ ...expenseData, tenant_id: tenant.id })

            if (expenseResult.error) {
                console.error("[Server Action] Error inserting tenant transaction:", expenseResult.error)
                return { success: false, error: "Gagal menyimpan rekod perbelanjaan" }
            }
            console.log("[Server Action] Tenant expense created")
        } else {
            // organizer
            const { data: organizer, error: orgError } = await supabase
                .from('organizers')
                .select('id')
                .eq('profile_id', user.id)
                .single()

            if (orgError || !organizer) {
                console.error("[Server Action] Organizer not found:", orgError)
                return { success: false, error: "Rekod penganjur tidak dijumpai" }
            }

            expenseResult = await supabase
                .from('organizer_transactions')
                .insert({ ...expenseData, organizer_id: organizer.id })

            if (expenseResult.error) {
                console.error("[Server Action] Error inserting organizer transaction:", expenseResult.error)
                return { success: false, error: "Gagal menyimpan rekod perbelanjaan" }
            }
            console.log("[Server Action] Organizer expense created")
        }

        // 2. Create income transaction for admin (Cash In) using admin client
        const adminSupabase = createAdminClient()
        
        const { error: adminError } = await adminSupabase
            .from('admin_transactions')
            .insert({
                description: `Langganan Pelan ${planName} - ${user.email}`,
                amount: amount,
                type: 'income',
                category: 'Langganan',
                date: new Date().toISOString().split('T')[0],
                status: 'pending',
                payment_method: 'bank_transfer',
                payment_reference: transactionId,
                receipt_url: receiptUrl,
                notes: `Bank: ${bankName} | ID: ${transactionId}${notes ? ` | ${notes}` : ''}`,
                metadata: {
                    plan_type: planName.toLowerCase(),
                    bank_name: bankName,
                    transaction_id: transactionId,
                    payer_email: user.email,
                    payer_name: user.user_metadata?.full_name || user.email,
                    user_id: user.id,
                    user_role: userRole,
                    is_manual_payment: true,
                    requires_verification: true,
                    submitted_at: new Date().toISOString()
                }
            })

        if (adminError) {
            console.error("[Server Action] Admin transaction error:", adminError)
            return { success: false, error: "Gagal menyimpan rekod admin: " + adminError.message }
        }

        console.log("[Server Action] Admin income created successfully")

        return { success: true }

    } catch (error: any) {
        console.error("[Server Action] Error:", error)
        return { success: false, error: error.message || "Ralat semasa memproses pembayaran" }
    }
}
