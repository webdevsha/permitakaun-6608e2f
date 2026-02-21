
interface SendEmailProps {
    to: string
    subject: string
    html: string
    apiKeyType?: 'default' | 'shafira' | 'hazman'
}

// Sender email configuration based on API key type
// NOTE: Default now uses BREVO_HAZMAN (Hazman's API key) as the main system API key
const SENDER_CONFIG = {
    default: {
        name: "Permit Akaun",
        email: "admin@kumim.my"       // BREVO_HAZMAN uses Hazman's email
    },
    shafira: {
        name: "Permit Akaun",
        email: "hai@shafiranoh.com"  // Shafira's email
    },
    hazman: {
        name: "Permit Akaun",
        email: "admin@kumim.my"       // Hazman's email
    }
}

export async function sendEmail({ to, subject, html, apiKeyType = 'default' }: SendEmailProps) {
    // Select API key based on preference
    let apiKey: string | undefined
    
    switch (apiKeyType) {
        case 'shafira':
            apiKey = process.env.BREVO_SHAFIRA || process.env.BREVO_API_KEY
            break
        case 'hazman':
            apiKey = process.env.BREVO_HAZMAN
            break
        case 'default':
        default:
            // Default now uses BREVO_HAZMAN as the main API key
            apiKey = process.env.BREVO_HAZMAN || process.env.BREVO_API_KEY
            break
    }

    if (!apiKey) {
        console.warn(`BREVO API Key is not set for type: ${apiKeyType}. Email not sent.`)
        return { 
            success: false, 
            error: "API Key missing",
            apiKeyType 
        }
    }

    // Get sender configuration based on API key type
    const sender = SENDER_CONFIG[apiKeyType] || SENDER_CONFIG.default

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: sender,
                to: [{ email: to }],
                subject: subject,
                htmlContent: html,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error("Brevo API Error:", errorData)
            return { success: false, error: errorData, apiKeyType, sender: sender.email }
        }

        const data = await response.json()
        console.log("Email sent successfully:", { ...data, apiKeyType, sender: sender.email })
        return { success: true, data, apiKeyType, sender: sender.email }
    } catch (error) {
        console.error("Failed to send email:", error)
        return { success: false, error, apiKeyType, sender: sender.email }
    }
}

// Get current API key info (for display purposes)
export function getApiKeyInfo() {
    return {
        default: {
            key: process.env.BREVO_HAZMAN ? '***' + process.env.BREVO_HAZMAN.slice(-10) : 
                 process.env.BREVO_API_KEY ? '***' + process.env.BREVO_API_KEY.slice(-10) : 'Not set',
            isSet: !!(process.env.BREVO_HAZMAN || process.env.BREVO_API_KEY),
            label: 'BREVO_HAZMAN (Default/Main)',
            senderEmail: SENDER_CONFIG.default.email
        },
        shafira: {
            key: process.env.BREVO_SHAFIRA ? '***' + process.env.BREVO_SHAFIRA.slice(-10) : 'Not set',
            isSet: !!process.env.BREVO_SHAFIRA,
            label: 'BREVO_SHAFIRA',
            senderEmail: SENDER_CONFIG.shafira.email
        },
        hazman: {
            key: process.env.BREVO_HAZMAN ? '***' + process.env.BREVO_HAZMAN.slice(-10) : 'Not set',
            isSet: !!process.env.BREVO_HAZMAN,
            label: 'BREVO_HAZMAN',
            senderEmail: SENDER_CONFIG.hazman.email
        }
    }
}

// Get sender email for a specific API key type
export function getSenderEmail(apiKeyType: 'default' | 'shafira' | 'hazman' = 'default'): string {
    return SENDER_CONFIG[apiKeyType]?.email || SENDER_CONFIG.default.email
}
