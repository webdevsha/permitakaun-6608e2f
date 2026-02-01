'use server'

import { createClient } from "@/utils/supabase/server"
import { PAYMENT_CONFIG } from "@/utils/payment/config"
import { revalidatePath } from "next/cache"

export async function getPaymentMode() {
    const supabase = await createClient()

    // Default to DB setting, fallback to ENV
    const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'payment_mode')
        .single()

    if (data && data.value) {
        return data.value
    }

    return PAYMENT_CONFIG.isSandbox ? 'sandbox' : 'real'
}

export async function updatePaymentMode(mode: 'sandbox' | 'real') {
    const supabase = await createClient()

    // Check permission (RLS handles it but good to check role logic if needed)
    // RLS policy created allows staff/admin/superadmin update

    const { error } = await supabase
        .from('system_settings')
        .upsert({
            key: 'payment_mode',
            value: mode,
            updated_at: new Date().toISOString()
        })

    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    revalidatePath('/dashboard')
    return { success: true }
}
