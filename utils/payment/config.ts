export const PAYMENT_CONFIG = {
    isSandbox: process.env.NEXT_PUBLIC_PAYMENT_MODE === 'sandbox',

    billplz: {
        apiKey: process.env.BILLPLZ_API_KEY,
        xSignature: process.env.BILLPLZ_X_SIGNATURE,
        collectionId: process.env.BILLPLZ_COLLECTION_ID,
        endpoint: 'https://www.billplz.com/api/v3'
    },

    chipIn: {
        brandId: process.env.CHIP_BRAND_ID, // Use if needed, or just token
        apiKey: process.env.CHIP_API_KEY,
        endpoint: 'https://gate.chip-in.asia/api/v1' // Verify endpoint for "Chip-in" or "Chip"
    }
}

// NOTE: User provided keys directly. 
// Billplz Real: 
// Secret: 9f563239-28b1-49a1-8e30-a3a460952104
// XSig: a4575f976cfa759dc096213efc5ed2630f9c3690013a22eb34f0e7ecda66ffec3ebdad9b4e44edc3cdd064808e8dd5ac11967765fb7e5a92a637252946dbc53e
// Coll ID: 3fzm_hsh
//
// Chip-in Test: 
// P1MT-7tIkrcilPUccyXWD-safOuKDA4_fOTgOn-WcQRmNUBOVlRGc1DS9VRXyjWVcowIzrHcvwIIJbM8qaGc2A==
