import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendPaymentReceiptAction } from "@/actions/email"

export async function POST(req: NextRequest) {
    console.log("[Payment Callback] ========== START ==========")
    
    try {
        const supabase = createAdminClient()
        const formData = await req.formData()
        
        const id = formData.get('id')
        const paid = formData.get('paid')
        const state = formData.get('state')
        const amount = formData.get('amount')
        const paid_amount = formData.get('paid_amount')
        const email = formData.get('email')
        const name = formData.get('name')
        const receipt_url = formData.get('url')

        console.log("[Payment Callback] Received data:", { 
            id, paid, state, amount: paid_amount, email 
        })

        if (paid !== 'true' || state !== 'paid') {
            console.log("[Payment Callback] Payment not successful, ignoring")
            return NextResponse.json({ status: 'ignored', reason: 'not_paid' })
        }

        const billplzId = id?.toString()
        if (!billplzId) {
            console.error("[Payment Callback] No billplz ID provided")
            return NextResponse.json({ error: "No billplz ID" }, { status: 400 })
        }

        // Try to update tenant_payments first (for logged-in tenant payments)
        console.log("[Payment Callback] Checking tenant_payments...")
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
            .maybeSingle()

        if (payment) {
            console.log("[Payment Callback] Found and updated tenant_payments record:", payment.id)
            
            // Send receipt email
            if (payment.tenants?.email) {
                const tenantName = payment.tenants.full_name
                const tenantEmail = payment.tenants.email
                const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
                const date = new Date().toLocaleString('ms-MY')

                console.log("[Payment Callback] Sending receipt email to tenant:", tenantEmail)
                await sendPaymentReceiptAction(
                    tenantEmail,
                    tenantName,
                    formattedAmount,
                    date,
                    "Pembayaran Sewa/Permit"
                )
                console.log("[Payment Callback] Email sent successfully")
            }
            
            return NextResponse.json({ success: true, type: 'tenant_payment' })
        }

        // For public payments - try organizer_transactions
        console.log("[Payment Callback] Checking organizer_transactions...")
        
        // Try to find by payment_reference
        let { data: orgTx } = await supabase
            .from('organizer_transactions')
            .select('*')
            .eq('payment_reference', billplzId)
            .maybeSingle()

        // If not found, try to find recent pending transaction
        if (!orgTx) {
            console.log("[Payment Callback] Not found by payment_reference, looking for recent pending...")
            const { data: pendingTxs } = await supabase
                .from('organizer_transactions')
                .select('*')
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - 600000).toISOString()) // Last 10 minutes
                .order('created_at', { ascending: false })
                .limit(1)

            if (pendingTxs && pendingTxs.length > 0) {
                orgTx = pendingTxs[0]
                console.log("[Payment Callback] Found recent pending transaction:", orgTx.id)
            }
        }

        if (orgTx) {
            console.log("[Payment Callback] Updating organizer_transaction:", orgTx.id)
            
            // Update the transaction
            await supabase
                .from('organizer_transactions')
                .update({
                    status: 'completed',
                    payment_reference: billplzId,
                    receipt_url: receipt_url?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', orgTx.id)

            // Send receipt email
            const metadata = orgTx.metadata || {}
            const payerEmail = metadata.payer_email || email
            const payerName = metadata.payer_name || name || 'Pengguna'
            
            if (payerEmail) {
                const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
                const date = new Date().toLocaleString('ms-MY')
                
                console.log("[Payment Callback] Sending receipt email to payer:", payerEmail)
                await sendPaymentReceiptAction(
                    payerEmail.toString(),
                    payerName.toString(),
                    formattedAmount,
                    date,
                    "Pembayaran Sewa/Permit"
                )
                console.log("[Payment Callback] Email sent successfully")
            } else {
                console.log("[Payment Callback] No payer email found in metadata")
            }
            
            return NextResponse.json({ success: true, type: 'organizer_transaction' })
        }

        console.warn("[Payment Callback] Payment record not found for billplz_id:", billplzId)
        return NextResponse.json({ 
            success: false, 
            error: "Payment record not found",
            billplzId 
        }, { status: 404 })

    } catch (e: any) {
        console.error("[Payment Callback] ERROR:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    } finally {
        console.log("[Payment Callback] ========== END ==========")
    }
}
