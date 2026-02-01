'use server'

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

export async function createStaffAccount(formData: FormData) {
    const email = formData.get('email') as string
    const fullName = formData.get('fullName') as string
    const password = formData.get('password') as string

    if (!email || !fullName || !password) {
        return { error: "Semua medan wajib diisi." }
    }

    try {
        const supabaseAdmin = createAdminClient()

        // 1. Create User in Auth
        const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role: 'staff'
            }
        })

        if (createError) throw createError

        // 2. Profile creation is handled by Trigger (handle_new_user)
        // The trigger will read metadata role='staff' and insert into profiles properly.

        revalidatePath('/admin')
        return { success: true, message: "Akaun staf berjaya dicipta." }

    } catch (error: any) {
        console.error("Create Staff Error:", error)
        return { error: error.message || "Gagal mencipta akaun." }
    }
}
