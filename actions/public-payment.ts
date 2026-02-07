'use server'

import { createAdminClient } from "@/utils/supabase/admin"

export async function createPublicPaymentTransaction(data: {
    description: string
    amount: number
    organizer_id: string
    location_id: number
    metadata: {
        payer_name: string
        payer_phone: string
        payer_email?: string
        business_name?: string
        stall_number?: string
        organizer_id: string
        organizer_code: string
        location_id: number
        location_name: string
        rate_type: string
        is_public_payment: boolean
        payment_method: string
    }
}) {
    try {
        // Use admin client to bypass RLS for public payments
        const supabase = createAdminClient()
        
        const { data: transaction, error } = await supabase
            .from('organizer_transactions')
            .insert({
                description: data.description,
                amount: data.amount,
                type: 'income',
                category: 'Sewa',
                status: 'pending',
                date: new Date().toISOString().split('T')[0],
                organizer_id: data.organizer_id,
                location_id: data.location_id,
                is_auto_generated: false,
                metadata: data.metadata
            })
            .select()
            .single()

        if (error) {
            console.error('[Public Payment] Error creating transaction:', error)
            return { success: false, error: error.message }
        }

        return { success: true, transaction }
    } catch (error: any) {
        console.error('[Public Payment] Exception:', error)
        return { success: false, error: error.message }
    }
}

export async function updatePaymentTransactionWithRef(
    transactionId: string,
    paymentRef: string,
    receiptUrl: string
) {
    try {
        const supabase = createAdminClient()
        
        const { error } = await supabase
            .from('organizer_transactions')
            .update({
                payment_reference: paymentRef,
                receipt_url: receiptUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', transactionId)

        if (error) {
            console.error('[Public Payment] Error updating transaction:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        console.error('[Public Payment] Exception:', error)
        return { success: false, error: error.message }
    }
}
