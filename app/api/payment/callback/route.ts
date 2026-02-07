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
            // Try to update tenant_payments first (for logged-in tenant payments)
            const { data: payment, error: tpError } = await supabase
                .from('tenant_payments')
                .update({
                    status: 'approved',
                    billplz_id: id?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('billplz_id', id)
                .select('*, tenants(full_name, email)')
                .single()

            if (payment) {
                console.log("[Payment Callback] Updated tenant_payments record")
                
                // Send receipt email for tenant payment
                if (payment.tenants?.email) {
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
                }
                
                return NextResponse.json({ success: true, type: 'tenant_payment' })
            }

            // If not found in tenant_payments, try organizer_transactions (for public payments)
            const { data: orgTx, error: otError } = await supabase
                .from('organizer_transactions')
                .update({
                    status: 'completed',
                    payment_reference: id?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('payment_reference', id)
                .select('*')
                .single()

            if (orgTx) {
                console.log("[Payment Callback] Updated organizer_transactions record")
                
                // For public payments, try to send receipt to the payer email from metadata
                const metadata = orgTx.metadata || {}
                const payerEmail = metadata.payer_email || email
                const payerName = metadata.payer_name || name || 'Pengguna'
                
                if (payerEmail) {
                    const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
                    const date = new Date().toLocaleString('ms-MY')
                    
                    await sendPaymentReceiptAction(
                        payerEmail.toString(),
                        payerName.toString(),
                        formattedAmount,
                        date,
                        "Pembayaran Sewa/Permit"
                    )
                    console.log("[Payment Callback] Receipt email sent to payer", payerEmail)
                }
                
                return NextResponse.json({ success: true, type: 'organizer_transaction' })
            }

            // Log if neither was found
            console.warn("[Payment Callback] Payment record not found for billplz_id:", id)
            return NextResponse.json({ success: false, error: "Payment record not found" }, { status: 404 })
        }

        return NextResponse.json({ status: 'ignored' })

    } catch (e: any) {
        console.error("[Payment Callback] Error:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
