
interface SendEmailProps {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailProps) {
    const apiKey = process.env.BREVO_API_KEY

    if (!apiKey) {
        console.warn("BREVO_API_KEY is not set. Email not sent.")
        return { success: false, error: "API Key missing" }
    }

    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: "Permit Akaun",
                    email: "admin@kumim.my",
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json()
            console.error("Brevo API Error:", errorData)
            return { success: false, error: errorData }
        }

        const data = await response.json()
        console.log("Email sent successfully:", data)
        return { success: true, data }
    } catch (error) {
        console.error("Failed to send email:", error)
        return { success: false, error }
    }
}
