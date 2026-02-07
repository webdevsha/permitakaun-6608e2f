'use server'

import { PAYMENT_CONFIG } from "@/utils/payment/config"
import { createBillplzBill, createChipInPayment } from "@/utils/payment/gateways"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { redirect } from "next/navigation"
import { getPaymentMode } from "@/actions/settings"
import { updatePaymentTransactionWithRef } from "./public-payment"

export async function initiatePayment(params: {
    amount: number,
    description: string,
    metadata?: any,
    redirectPath: string,
    transactionId?: string, // For public payments - update existing record
    payerEmail?: string,    // For public payments - use provided email
    payerName?: string      // For public payments - use provided name
}) {
    const supabase = await createClient()
    
    // For public payments, use provided email/name
    // For logged-in users, get from auth
    let email = params.payerEmail
    let name = params.payerName
    
    if (!email) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) {
            return { error: "Pengguna tidak dijumpai." }
        }
        email = user.email
        name = user.user_metadata?.full_name || 'User'
    }

    // Dynamic Mode Check
    let mode = 'sandbox'
    try {
        mode = await getPaymentMode()
    } catch (e) {
        console.error("Error fetching payment mode, defaulting to sandbox:", e)
    }

    console.log(`[Payment] Initiating payment in ${mode} mode for ${email}`)
    console.log(`[Payment] Config:`, {
        billplzKey: PAYMENT_CONFIG.billplz.apiKey ? 'Set' : 'Missing',
        chipKey: PAYMENT_CONFIG.chipIn.apiKey ? 'Set' : 'Missing',
        transactionId: params.transactionId || 'None (will create tenant_payment)'
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const statusPageUrl = `${baseUrl}/payment/status`
    // Encode the path to return to after status page
    const nextPathEncoded = encodeURIComponent(params.redirectPath)

    // Encode metadata if present (for subscription features)
    let metadataQuery = ''
    if (params.metadata) {
        if (params.metadata.planType) metadataQuery += `&planType=${params.metadata.planType}`
        if (params.metadata.isSubscription) metadataQuery += `&isSubscription=true`
    }

    const callbackUrl = `${baseUrl}/api/payment/callback`

    let result;

    try {
        if (mode === 'sandbox') {
            console.log("[Payment] Calling Billplz SANDBOX API...")
            // Reuse Billplz logic but with isSandbox = true
            result = await createBillplzBill({
                email: email!,
                name: name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                redirectUrl: `${statusPageUrl}?gateway=billplz&next=${nextPathEncoded}${metadataQuery}`
            }, true) // <--- True for Sandbox
        } else {
            console.log("[Payment] Calling Billplz API...")
            // Billplz redirects to ONE url and appends billplz[...] params
            result = await createBillplzBill({
                email: email!,
                name: name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                // Billplz will append data here
                redirectUrl: `${statusPageUrl}?gateway=billplz&next=${nextPathEncoded}${metadataQuery}`
            })
        }

        console.log("[Payment] Result:", result)

        if (result && result.url) {
            // Check if this is a subscription payment
            const isSubscription = params.metadata?.isSubscription === true
            
            // If transactionId provided (public payment), update the organizer_transaction
            if (params.transactionId) {
                const updateResult = await updatePaymentTransactionWithRef(
                    params.transactionId,
                    result.id,
                    result.url
                )

                if (!updateResult.success) {
                    console.error("[Payment] Failed to update organizer_transaction:", updateResult.error)
                } else {
                    console.log("[Payment] Updated organizer_transaction with payment reference.")
                }
            } else if (isSubscription) {
                // For subscription payments - store in admin_transactions as income
                const { data: { user } } = await supabase.auth.getUser()
                
                // Use admin client to bypass RLS
                const adminSupabase = createAdminClient()
                
                const insertData: any = {
                    description: params.description,
                    amount: params.amount,
                    type: 'income',
                    category: 'Langganan',
                    date: new Date().toISOString().split('T')[0],
                    status: 'pending',
                    receipt_url: result.url,
                    is_sandbox: mode === 'sandbox'
                }
                
                // Only add these fields if columns exist (migration applied)
                // Using try-catch to handle potential column mismatches
                try {
                    const { error: subTxError } = await adminSupabase.from('admin_transactions').insert({
                        ...insertData,
                        payment_method: 'billplz',
                        payment_reference: result.id,
                        metadata: {
                            payer_email: email,
                            payer_name: name,
                            user_id: user?.id,
                            plan_type: params.metadata?.planType || 'basic',
                            is_subscription: true
                        },
                        created_by: user?.id
                    })

                    if (subTxError) {
                        console.error("[Payment] Failed to record subscription payment:", subTxError)
                        // Try again with minimal fields if columns might be missing
                        await adminSupabase.from('admin_transactions').insert(insertData)
                        console.log("[Payment] Recorded subscription payment (minimal fields).")
                    } else {
                        console.log("[Payment] Recorded subscription payment to admin_transactions.")
                    }
                } catch (insertError) {
                    console.error("[Payment] Error inserting to admin_transactions:", insertError)
                    // Fallback: insert minimal data
                    try {
                        await adminSupabase.from('admin_transactions').insert(insertData)
                        console.log("[Payment] Recorded subscription payment (fallback).")
                    } catch (fallbackError) {
                        console.error("[Payment] Fallback insert failed:", fallbackError)
                    }
                }
            } else {
                // For logged-in tenant payments - insert into tenant_payments
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('id, organizer_code')
                    .eq('profile_id', (await supabase.auth.getUser()).data.user?.id)
                    .single()

                if (tenant) {
                    const { error: txError } = await supabase.from('tenant_payments').insert({
                        tenant_id: tenant.id,
                        organizer_code: tenant.organizer_code,
                        payment_date: new Date().toISOString(),
                        amount: params.amount,
                        status: 'pending',
                        payment_method: 'billplz',
                        billplz_id: result.id,
                        receipt_url: result.url,
                        is_sandbox: mode === 'sandbox'
                    })

                    if (txError) {
                        console.error("[Payment] Failed to record pending payment:", txError)
                    } else {
                        console.log("[Payment] Recorded pending payment to tenant_payments.")
                    }
                }
            }

            return { success: true, url: result.url }
        } else {
            return { error: "Gagal mendapatkan URL pembayaran." }
        }

    } catch (e: any) {
        console.error("[Payment] Init Error:", e)
        return { error: e.message || "Ralat semasa memulakan pembayaran." }
    }
}
