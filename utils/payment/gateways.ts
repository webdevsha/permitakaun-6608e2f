import { PAYMENT_CONFIG } from "./config"

// --- BILLPLZ IMPLEMENTATION (Real) ---
export async function createBillplzBill(params: {
    email: string,
    name: string,
    amount: number, // in MYR
    description: string,
    callbackUrl: string,
    redirectUrl: string
}, isSandbox = false) {
    // Select Config (Real vs Sandbox)
    const config = isSandbox ? PAYMENT_CONFIG.billplzSandbox : PAYMENT_CONFIG.billplz

    if (!config.apiKey || !config.collectionId) {
        throw new Error(`Billplz ${isSandbox ? 'Sandbox' : 'Real'} API Key or Collection ID missing.`)
    }

    const url = `${config.endpoint}/bills`
    const auth = Buffer.from(`${config.apiKey}:`).toString('base64')

    // Amount in cents for Billplz
    const amountCents = Math.round(params.amount * 100)

    const body = JSON.stringify({
        collection_id: config.collectionId,
        email: params.email,
        name: params.name,
        amount: amountCents,
        description: params.description,
        callback_url: params.callbackUrl,
        redirect_url: params.redirectUrl,
        deliver: false // Don't send email automatically if handled by app
    })

    // console.log("Creating Billplz Bill:", body)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body
    })

    const data = await response.json()
    if (!response.ok) {
        throw new Error(`Billplz Error: ${JSON.stringify(data)}`)
    }

    return {
        id: data.id,
        url: data.url,
        gateway: 'billplz'
    }
}

// --- CHIP-IN IMPLEMENTATION (Sandbox) ---
// Assuming "Chip-in" refers to a gateway compatible with the provided key. 
// If specific docs are needed, user might need to provide. 
// Using a generic implementation based on typical keys.
// Key provided: P1MT-7tIkrcilPUccyXWD-safOuKDA4_fOTgOn-WcQRmNUBOVlRGc1DS9VRXyjWVcowIzrHcvwIIJbM8qaGc2A==
// This looks like a Bearer token.
// Endpoint: https://gate.chip-in.asia/api/v1/purchases/ (Hypothetical or standard Chip)

export async function createChipInPayment(params: {
    email: string,
    amount: number,
    description: string,
    redirectUrl: string
}) {
    // Use the test endpoint or inferred endpoint
    const url = 'https://gate.chip-in.asia/api/v1/purchases/'

    // Chip-in usually requires detailed products.
    const amountCents = Math.round(params.amount * 100)

    // Check for existing query params to decide separator
    const separator = params.redirectUrl.includes('?') ? '&' : '?'

    const body = JSON.stringify({
        brand_id: PAYMENT_CONFIG.chipIn.brandId,
        success_redirect: `${params.redirectUrl}${separator}status=success`,
        failure_redirect: `${params.redirectUrl}${separator}status=failure`,
        purchase: {
            products: [
                {
                    name: params.description.substring(0, 256),
                    price: amountCents,
                    quantity: 1
                }
            ]
        },
        client: {
            email: params.email,
        }
    })

    // console.log("[Chip-In] Request:", url, body)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PAYMENT_CONFIG.chipIn.apiKey}`,
            'Content-Type': 'application/json'
        },
        body
    })

    const responseText = await response.text()
    console.log("[Chip-In] Raw Response:", responseText)

    let data
    try {
        data = JSON.parse(responseText)
    } catch (e) {
        throw new Error(`Invalid JSON from Chip-In: ${responseText.substring(0, 100)}...`)
    }

    if (!response.ok) {
        console.error("Chip Error Data:", data)
        throw new Error(`Chip-In Error (${response.status}): ${JSON.stringify(data)}`)
    }

    return {
        id: data.id,
        url: data.checkout_url,
        gateway: 'chip-in'
    }
}
