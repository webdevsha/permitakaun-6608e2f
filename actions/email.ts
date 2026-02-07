"use server"

import { sendEmail } from "@/lib/email"
import { welcomeEmail, paymentReceiptEmail, accountActivatedEmail } from "@/lib/email-templates"

export async function sendWelcomeEmailAction(email: string, name: string) {
    try {
        const html = welcomeEmail(name)
        const result = await sendEmail({
            to: email,
            subject: "Selamat Datang ke Permit Akaun!",
            html
        })
        return result
    } catch (error) {
        console.error("Failed to send welcome email:", error)
        return { success: false, error }
    }
}

export async function sendPaymentReceiptAction(email: string, name: string, amount: string, date: string, description: string) {
    try {
        const html = paymentReceiptEmail(name, amount, date, description)
        const result = await sendEmail({
            to: email,
            subject: "Resit Pembayaran - Permit Akaun",
            html
        })
        return result
    } catch (error) {
        console.error("Failed to send receipt email:", error)
        return { success: false, error }
    }
}

export async function sendAccountActivatedAction(email: string, name: string) {
    try {
        const html = accountActivatedEmail(name)
        const result = await sendEmail({
            to: email,
            subject: "Tahniah! Akaun Anda Telah Diaktifkan",
            html
        })
        return result
    } catch (error) {
        console.error("Failed to send activation email:", error)
        return { success: false, error }
    }
}
