import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { sendPaymentReceiptAction } from "@/actions/email"

export async function POST(req: NextRequest) {
    const supabase = await createClient()

    try {
        const formData = await req.formData()
        const id = formData.get('id')
        const paid = formData.get('paid')
        const state = formData.get('state')
        const amount = formData.get('amount')
        const paid_amount = formData.get('paid_amount')
        const email = formData.get('email')
        const name = formData.get('name')
        const receipt_url = formData.get('url')

        console.log("[Payment Callback] Received:", { id, paid, state, amount, email })

        if (paid === 'true' && state === 'paid') {
            // 1. Update Payment Status in DB
            const { data: payment, error } = await supabase
                .from('tenant_payments')
                .update({
                    status: 'approved',
                    billplz_id: id?.toString(), // Store ID to prevent duplicates if needed
                    updated_at: new Date().toISOString()
                })
                .eq('billplz_id', id)
                .select('*, tenants(full_name, email)') // Get Tenant Details
                .single()

            if (error) {
                console.error("[Payment Callback] DB Update Error:", error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            // 2. Send Receipt Email
            if (payment && payment.tenants && payment.tenants.email) {
                const tenantName = payment.tenants.full_name
                const tenantEmail = payment.tenants.email
                const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
                const date = new Date().toLocaleString('ms-MY')

                await sendPaymentReceiptAction(
                    tenantEmail,
                    tenantName,
                    formattedAmount,
                    date,
                    "Pembayaran Sewa/Permit"
                )
                console.log("[Payment Callback] Receipt email sent to", tenantEmail)
            } else if (email) {
                // Fallback if DB relation fails but callback has email
                const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
                const date = new Date().toLocaleString('ms-MY')
                await sendPaymentReceiptAction(
                    email.toString(),
                    name?.toString() || 'Pengguna',
                    formattedAmount,
                    date,
                    "Pembayaran Sewa/Permit"
                )
            }

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ status: 'ignored' })

    } catch (e: any) {
        console.error("[Payment Callback] Error:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
