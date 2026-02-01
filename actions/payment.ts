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
    const mode = await getPaymentMode()

    // ... rest of logic ...
    const fullRedirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${params.redirectPath}`
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payment/callback`

    let result;

    try {
        if (mode === 'sandbox') {
            // Use Chip-In
            result = await createChipInPayment({
                email: user.email,
                amount: params.amount,
                description: params.description,
                redirectUrl: fullRedirectUrl
            })
        } else {
            // Use Billplz
            result = await createBillplzBill({
                email: user.email,
                name: user.user_metadata?.full_name || 'User',
                amount: params.amount,
                description: params.description,
                callbackUrl: callbackUrl,
                redirectUrl: fullRedirectUrl
            })
        }

        if (result && result.url) {
            // Optionally store the transaction in DB as 'pending' before redirecting
            // For now, we assume the redirect handles flow or we just return the URL
            return { success: true, url: result.url }
        } else {
            return { error: "Gagal mendapatkan URL pembayaran." }
        }

    } catch (e: any) {
        console.error("Payment Init Error:", e)
        return { error: e.message || "Ralat semasa memulakan pembayaran." }
    }
}
