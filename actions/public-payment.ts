'use server'

import { createClient } from "@/utils/supabase/server"

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
        const supabase = await createClient()
        
        // Use RPC function to bypass RLS
        const { data: result, error } = await supabase
            .rpc('create_public_payment_transaction', {
                p_description: data.description,
                p_amount: data.amount,
                p_organizer_id: data.organizer_id,
                p_location_id: data.location_id,
                p_metadata: data.metadata
            })

        if (error) {
            console.error('[Public Payment] RPC error:', error)
            return { success: false, error: error.message }
        }

        if (!result || !result.success) {
            return { success: false, error: 'Failed to create transaction' }
        }

        // Fetch the created transaction to return full data
        const { data: transaction, error: fetchError } = await supabase
            .from('organizer_transactions')
            .select('*')
            .eq('id', result.id)
            .single()

        if (fetchError) {
            console.error('[Public Payment] Fetch error:', fetchError)
            // Return partial data
            return { 
                success: true, 
                transaction: { id: result.id }
            }
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
        const supabase = await createClient()
        
        // Use RPC function to bypass RLS
        const { data: result, error } = await supabase
            .rpc('update_payment_transaction_ref', {
                p_transaction_id: transactionId,
                p_payment_ref: paymentRef,
                p_receipt_url: receiptUrl
            })

        if (error) {
            console.error('[Public Payment] RPC update error:', error)
            return { success: false, error: error.message }
        }

        return { success: true }
    } catch (error: any) {
        console.error('[Public Payment] Update exception:', error)
        return { success: false, error: error.message }
    }
}
