"use server"

import { sendEmail } from "@/lib/email"
import { welcomeEmail, paymentReceiptEmail, accountActivatedEmail, adminPaymentNotificationEmail } from "@/lib/email-templates"

// Store the current API key preference (in-memory for server)
let currentApiKeyType: 'default' | 'shafira' | 'hazman' = 'default'

export async function setEmailApiKeyType(type: 'default' | 'shafira' | 'hazman') {
    currentApiKeyType = type
    console.log(`[Email] API Key switched to: ${type}`)
    return { success: true, currentType: type }
}

export async function getEmailApiKeyType() {
    return { currentType: currentApiKeyType }
}

export async function sendWelcomeEmailAction(email: string, name: string, organizerCode?: string, apiKeyType?: 'default' | 'shafira' | 'hazman') {
    try {
        const keyType = apiKeyType || currentApiKeyType
        const html = welcomeEmail(name, organizerCode)
        const result = await sendEmail({
            to: email,
            subject: "Selamat Datang ke Permit Akaun!",
            html,
            apiKeyType: keyType
        })
        return result
    } catch (error) {
        console.error("Failed to send welcome email:", error)
        return { success: false, error }
    }
}

export async function sendPaymentReceiptAction(
    email: string,
    name: string,
    amount: string,
    date: string,
    description: string,
    extra?: { organizerName?: string, locationName?: string },
    apiKeyType?: 'default' | 'shafira' | 'hazman'
) {
    try {
        const keyType = apiKeyType || currentApiKeyType
        const html = paymentReceiptEmail(name, amount, date, description, extra)
        const result = await sendEmail({
            to: email,
            subject: "Resit Pembayaran - Permit Akaun",
            html,
            apiKeyType: keyType
        })
        return result
    } catch (error) {
        console.error("Failed to send receipt email:", error)
        return { success: false, error }
    }
}

export async function sendAccountActivatedAction(email: string, name: string, apiKeyType?: 'default' | 'shafira' | 'hazman') {
    try {
        const keyType = apiKeyType || currentApiKeyType
        const html = accountActivatedEmail(name)
        const result = await sendEmail({
            to: email,
            subject: "Tahniah! Akaun Anda Telah Diaktifkan",
            html,
            apiKeyType: keyType
        })
        return result
    } catch (error) {
        console.error("Failed to send activation email:", error)
        return { success: false, error }
    }
}

// Admin email configuration based on API key type
const ADMIN_EMAILS = {
    default: "hai@shafiranoh.com",    // Shafira's admin email
    shafira: "hai@shafiranoh.com",    // Shafira's admin email
    hazman: "admin@kumim.my"          // Hazman's admin email
}

// Send payment notification to admin
export async function sendPaymentNotificationToAdminAction(
    params: {
        payerName: string
        payerEmail: string
        amount: string
        date: string
        description: string
        paymentType: 'tenant' | 'subscription' | 'public'
    },
    apiKeyType?: 'default' | 'shafira' | 'hazman'
) {
    try {
        const { payerName, payerEmail, amount, date, description, paymentType } = params
        const keyType = apiKeyType || currentApiKeyType

        // Get admin email based on API key type
        const adminEmail = ADMIN_EMAILS[keyType] || ADMIN_EMAILS.default

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
            to: adminEmail,
            subject: `[Permit Akaun] ${typeLabels[paymentType]} - RM ${amount}`,
            html,
            apiKeyType: keyType
        })

        console.log(`[Email] Admin notification sent to ${adminEmail} using`, keyType)
        return { ...result, adminEmail }
    } catch (error) {
        console.error("Failed to send admin notification email:", error)
        return { success: false, error }
    }
}
