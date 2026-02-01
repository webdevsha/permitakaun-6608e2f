'use server'

import { PAYMENT_CONFIG } from "@/utils/payment/config"
import { createBillplzBill, createChipInPayment } from "@/utils/payment/gateways"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { getPaymentMode } from "@/actions/settings"

export async function initiatePayment(params: {
    amount: number,
    description: string,
    metadata?: any,
    redirectPath: string
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !user.email) {
        return { error: "Pengguna tidak dijumpai." }
    }

    // Dynamic Mode Check
    let mode = 'sandbox'
    try {
        mode = await getPaymentMode()
    } catch (e) {
        console.error("Error fetching payment mode, defaulting to sandbox:", e)
    }

    console.log(`[Payment] Initiating payment in ${mode} mode for ${user.email}`)
    console.log(`[Payment] Config:`, {
        billplzKey: PAYMENT_CONFIG.billplz.apiKey ? 'Set' : 'Missing',
        chipKey: PAYMENT_CONFIG.chipIn.apiKey ? 'Set' : 'Missing'
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
                email: user.email,
                name: user.user_metadata?.full_name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                redirectUrl: `${statusPageUrl}?gateway=billplz&next=${nextPathEncoded}${metadataQuery}`
            }, true) // <--- True for Sandbox
        } else {
            console.log("[Payment] Calling Billplz API...")
            // Billplz redirects to ONE url and appends billplz[...] params
            result = await createBillplzBill({
                email: user.email,
                name: user.user_metadata?.full_name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                // Billplz will append data here
                redirectUrl: `${statusPageUrl}?gateway=billplz&next=${nextPathEncoded}${metadataQuery}`
            })
        }

        console.log("[Payment] Result:", result)

        if (result && result.url) {
            // Fetch Tenant ID
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .eq('profile_id', user.id)
                .single()

            if (tenant) {
                // Insert Pending Transaction
                const { error: txError } = await supabase.from('transactions').insert({
                    tenant_id: tenant.id,
                    date: new Date().toISOString(),
                    amount: params.amount,
                    type: 'expense', // From tenant perspective
                    category: 'Sewa',
                    description: `${params.description} (Ref: ${result.id})`,
                    status: 'pending',
                    receipt_url: result.url, // Store payment link
                })

                if (txError) {
                    console.error("[Payment] Failed to record pending tx:", txError)
                } else {
                    console.log("[Payment] Recorded pending transaction.")
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
