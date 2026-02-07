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
            const billplzId = id?.toString()
            
            // Try to update tenant_payments first (for logged-in tenant payments)
            const { data: payment, error: tpError } = await supabase
                .from('tenant_payments')
                .update({
                    status: 'approved',
                    billplz_id: billplzId,
                    receipt_url: receipt_url?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('billplz_id', billplzId)
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

            // For public payments, try to find and update via RPC
            // First, try to find by payment_reference
            const { data: byRef } = await supabase
                .from('organizer_transactions')
                .select('*')
                .eq('payment_reference', billplzId)
                .single()

            if (byRef) {
                // Update via RPC to bypass RLS
                await supabase.rpc('update_payment_transaction_ref', {
                    p_transaction_id: byRef.id,
                    p_payment_ref: billplzId,
                    p_receipt_url: receipt_url?.toString()
                })

                // Also update status to completed
                await supabase.rpc('update_transaction_status', {
                    p_transaction_id: byRef.id,
                    p_status: 'completed'
                })

                console.log("[Payment Callback] Updated organizer_transactions by reference")
                
                // Send receipt
                const metadata = byRef.metadata || {}
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
                }
                
                return NextResponse.json({ success: true, type: 'organizer_transaction' })
            }

            // If not found by reference, try to find recent pending transaction
            const { data: pendingTxs } = await supabase
                .from('organizer_transactions')
                .select('*')
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - 3600000).toISOString())
                .order('created_at', { ascending: false })
                .limit(5)

            if (pendingTxs && pendingTxs.length > 0) {
                const recentTx = pendingTxs[0]
                
                // Update via RPC
                await supabase.rpc('update_payment_transaction_ref', {
                    p_transaction_id: recentTx.id,
                    p_payment_ref: billplzId,
                    p_receipt_url: receipt_url?.toString()
                })

                await supabase.rpc('update_transaction_status', {
                    p_transaction_id: recentTx.id,
                    p_status: 'completed'
                })

                console.log("[Payment Callback] Updated recent pending transaction:", recentTx.id)
                
                // Send receipt
                const metadata = recentTx.metadata || {}
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
                }
                
                return NextResponse.json({ success: true, type: 'organizer_transaction' })
            }

            console.warn("[Payment Callback] Payment record not found for billplz_id:", id)
            return NextResponse.json({ success: false, error: "Payment record not found" }, { status: 404 })
        }

        return NextResponse.json({ status: 'ignored' })

    } catch (e: any) {
        console.error("[Payment Callback] Error:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
