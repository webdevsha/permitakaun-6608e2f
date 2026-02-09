
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Helper to parse env file
function loadEnv(filename: string, existingEnv: Record<string, string>) {
    try {
        const envPath = path.resolve(process.cwd(), filename)
        if (fs.existsSync(envPath)) {
            console.log(`Loading ${filename}...`)
            const envContent = fs.readFileSync(envPath, 'utf-8')
            envContent.split('\n').forEach(line => {
                const [key, ...value] = line.split('=')
                if (key && value && !key.trim().startsWith('#')) {
                    const k = key.trim()
                    // Don't overwrite if exists
                    if (!existingEnv[k]) {
                        existingEnv[k] = value.join('=').trim()
                    }
                }
            })
        }
    } catch (e) {
        console.error(`Error loading ${filename}:`, e)
    }
}

const env: Record<string, string> = {}
// Load order: .env.local usually overrides .env in Next.js, but here we want to fill gaps
loadEnv('.env.local', env)
loadEnv('.env', env)

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    console.error('URL:', supabaseUrl ? 'Set' : 'Missing')
    console.error('Key:', supabaseKey ? 'Set' : 'Missing')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTransaction(id: string) {
    console.log(`Checking transaction ${id}...`)
    const { data, error } = await supabase
        .from('organizer_transactions')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        console.error('Error fetching:', error)
    } else {
        console.log('Transaction Status:', data.status)
        console.log('Payment Ref:', data.payment_reference)

        // If status is not approved, let's update it for the user
        if (data.status !== 'approved') {
            console.log("Updating status to 'approved'...")
            const { error: updateError } = await supabase
                .from('organizer_transactions')
                .update({ status: 'approved' })
                .eq('id', id)

            if (updateError) {
                console.error("Update failed:", updateError)
            } else {
                console.log("Update SUCCESSFUL. Status is now 'approved'.")
            }
        } else {
            console.log("Status is already 'approved'.")
        }
    }
}

const id = process.argv[2]
if (id) {
    checkTransaction(id)
} else {
    console.log("Please provide an ID")
}
