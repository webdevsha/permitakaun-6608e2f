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

    const fullRedirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${params.redirectPath}`
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payment/callback`

    let result;

    try {
        if (mode === 'sandbox') {
            console.log("[Payment] Calling Chip-In API...")
            result = await createChipInPayment({
                email: user.email,
                amount: params.amount,
                description: params.description,
                redirectUrl: fullRedirectUrl
            })
        } else {
            console.log("[Payment] Calling Billplz API...")
            result = await createBillplzBill({
                email: user.email,
                name: user.user_metadata?.full_name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                redirectUrl: fullRedirectUrl
            })
        }

        console.log("[Payment] Result:", result)

        if (result && result.url) {
            // Optionally store the transaction in DB as 'pending' before redirecting
            // For now, we assume the redirect handles flow or we just return the URL
            return { success: true, url: result.url }
        } else {
            return { error: "Gagal mendapatkan URL pembayaran." }
        }

    } catch (e: any) {
        console.error("[Payment] Init Error:", e)
        return { error: e.message || "Ralat semasa memulakan pembayaran." }
    }
}
