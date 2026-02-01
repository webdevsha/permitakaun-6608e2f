'use server'

import { revalidatePath } from "next/cache"

export async function clearCache() {
    try {
        revalidatePath('/', 'layout')
        return { success: true, message: "Cache cleared successfully (Root Layout Revalidated)" }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}
