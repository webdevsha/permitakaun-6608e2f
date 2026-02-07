import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { sendPaymentReceiptAction, sendPaymentNotificationToAdminAction } from "@/actions/email"

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
            const formattedAmount = (parseInt(paid_amount as string) / 100).toFixed(2)
            const date = new Date().toLocaleString('ms-MY')

            // Try to update tenant_payments first (for logged-in tenant payments)
            const { data: payment, error: tpError } = await supabase
                .from('tenant_payments')
                .update({
                    status: 'approved',
                    billplz_id: id?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('billplz_id', id)
                .select('*, tenants(full_name, email, business_name, id)')
                .single()

            if (payment) {
                console.log("[Payment Callback] Updated tenant_payments record")
                
                // Send receipt email for tenant payment
                if (payment.tenants?.email) {
                    const tenantName = payment.tenants.full_name || payment.tenants.business_name
                    const tenantEmail = payment.tenants.email
                    
                    // Send to tenant
                    await sendPaymentReceiptAction(
                        tenantEmail,
                        tenantName,
                        formattedAmount,
                        date,
                        "Pembayaran Sewa/Permit"
                    )
                    console.log("[Payment Callback] Receipt email sent to tenant", tenantEmail)
                    
                    // Send notification to admin (Hazman)
                    await sendPaymentNotificationToAdminAction({
                        payerName: tenantName,
                        payerEmail: tenantEmail,
                        amount: formattedAmount,
                        date,
                        description: `Pembayaran Sewa/Permit oleh ${tenantName}`,
                        paymentType: 'tenant'
                    })
                    console.log("[Payment Callback] Notification sent to admin")
                }
                
                return NextResponse.json({ success: true, type: 'tenant_payment' })
            }

            // If not found in tenant_payments, try admin_transactions (for subscription payments)
            const { data: adminTx, error: atError } = await supabase
                .from('admin_transactions')
                .update({
                    status: 'approved',
                    payment_reference: id?.toString(),
                    updated_at: new Date().toISOString()
                })
                .eq('payment_reference', id)
                .select('*')
                .single()

            if (adminTx) {
                console.log("[Payment Callback] Updated admin_transactions record (subscription)")
                
                // For subscription payments
                const metadata = adminTx.metadata || {}
                const payerEmail = metadata.payer_email || email
                const payerName = metadata.payer_name || name || 'Pengguna'
                
                if (payerEmail) {
                    const description = 'Langganan Permit Akaun'
                    
                    // Send receipt to payer
                    await sendPaymentReceiptAction(
                        payerEmail.toString(),
                        payerName.toString(),
                        formattedAmount,
                        date,
                        description
                    )
                    console.log("[Payment Callback] Receipt email sent to subscriber", payerEmail)
                    
                    // Send notification to admin
                    await sendPaymentNotificationToAdminAction({
                        payerName: payerName.toString(),
                        payerEmail: payerEmail.toString(),
                        amount: formattedAmount,
                        date,
                        description: description + ` oleh ${payerName}`,
                        paymentType: 'subscription'
                    })
                    console.log("[Payment Callback] Notification sent to admin")
                }
                
                // Update the user's subscription status
                if (metadata.user_id) {
                    await updateUserSubscription(supabase, metadata.user_id, formattedAmount, id?.toString() || '', metadata.plan_type || 'basic')
                }
                
                return NextResponse.json({ success: true, type: 'admin_transaction_subscription' })
            }

            // Try organizer_transactions (for public payments - rent/permit)
            const { data: orgTx, error: otError } = await supabase
                .from('organizer_transactions')
                .update({
                    status: 'approved',
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
                    const description = 'Pembayaran Sewa/Permit'
                    
                    // Send to payer
                    await sendPaymentReceiptAction(
                        payerEmail.toString(),
                        payerName.toString(),
                        formattedAmount,
                        date,
                        description
                    )
                    console.log("[Payment Callback] Receipt email sent to payer", payerEmail)
                    
                    // Send notification to admin
                    await sendPaymentNotificationToAdminAction({
                        payerName: payerName.toString(),
                        payerEmail: payerEmail.toString(),
                        amount: formattedAmount,
                        date,
                        description: description + ` oleh ${payerName}`,
                        paymentType: 'public'
                    })
                    console.log("[Payment Callback] Notification sent to admin")
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

// Helper function to update user subscription after payment
async function updateUserSubscription(supabase: any, userId: string, amount: string, paymentRef: string, planType: string = 'basic') {
    try {
        // Get the tenant/organizer record for this user
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()
        
        if (!profile) {
            console.log("[Subscription Update] Profile not found for user:", userId)
            return
        }
        
        const now = new Date()
        const endDate = new Date()
        endDate.setDate(now.getDate() + 30) // Monthly subscription
        
        if (profile.role === 'tenant') {
            // Get tenant record
            const { data: tenant } = await supabase
                .from('tenants')
                .select('id')
                .eq('profile_id', userId)
                .single()
            
            if (tenant) {
                // Insert or update subscription
                await supabase.from('subscriptions').insert({
                    tenant_id: tenant.id,
                    plan_type: planType,
                    status: 'active',
                    start_date: now.toISOString(),
                    end_date: endDate.toISOString(),
                    amount: parseFloat(amount),
                    payment_ref: paymentRef
                })
                
                // Update tenant accounting status
                await supabase
                    .from('tenants')
                    .update({ accounting_status: 'active' })
                    .eq('id', tenant.id)
                
                console.log("[Subscription Update] Tenant subscription activated:", tenant.id, "Plan:", planType)
            }
        } else if (profile.role === 'organizer') {
            // Get organizer record
            const { data: organizer } = await supabase
                .from('organizers')
                .select('id')
                .eq('profile_id', userId)
                .single()
            
            if (organizer) {
                // Update organizer accounting status and store subscription info
                await supabase
                    .from('organizers')
                    .update({ 
                        accounting_status: 'active',
                        updated_at: now.toISOString()
                    })
                    .eq('id', organizer.id)
                
                console.log("[Subscription Update] Organizer subscription activated:", organizer.id, "Plan:", planType)
            }
        }
    } catch (error) {
        console.error("[Subscription Update] Error:", error)
    }
}
