'use server'

import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export async function login(prevState: { error: string } | undefined, formData: FormData) {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
        return { error: "Sila masukkan emel dan kata laluan" }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.error("Login server error:", error)
        return {
            error: error.message === "Invalid login credentials"
                ? "Emel atau kata laluan salah"
                : error.message
        }
    }

    return redirect("/dashboard")
}
