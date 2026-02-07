"use server"

import { sendEmail } from "@/lib/email"
import { welcomeEmail, paymentReceiptEmail, accountActivatedEmail, adminPaymentNotificationEmail } from "@/lib/email-templates"

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

// Send payment notification to admin (Hazman)
export async function sendPaymentNotificationToAdminAction(params: {
    payerName: string
    payerEmail: string
    amount: string
    date: string
    description: string
    paymentType: 'tenant' | 'subscription' | 'public'
}) {
    try {
        const { payerName, payerEmail, amount, date, description, paymentType } = params
        
        const typeLabels: Record<string, string> = {
            tenant: 'Pembayaran Peniaga',
            subscription: 'Langganan Baru',
            public: 'Pembayaran Awam'
        }
        
        const html = adminPaymentNotificationEmail(
            payerName,
            payerEmail,
            amount,
            date,
            description,
            typeLabels[paymentType] || 'Pembayaran'
        )
        
        const result = await sendEmail({
            to: "admin@kumim.my", // Hazman's email
            subject: `[Permit Akaun] ${typeLabels[paymentType]} - RM ${amount}`,
            html
        })
        
        console.log("[Email] Admin notification sent to admin@kumim.my")
        return result
    } catch (error) {
        console.error("Failed to send admin notification email:", error)
        return { success: false, error }
    }
}
