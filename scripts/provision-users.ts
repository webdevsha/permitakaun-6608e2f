
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfcoqymbxectgwedkbqa.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDYxODYsImV4cCI6MjA4MTc4MjE4Nn0.ExE_RSna8oYLe4cDr-AWLpHXV8AYjtHmiL3VE2MqyrA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function provisionUsers() {
    const users = [
        { email: 'manjaya.solution@gmail.com', password: 'pass1234', name: 'Staff Encik Hazman' },
        { email: 'admin@kumim.my', password: 'pass1234', name: 'Hazman' }
    ]

    for (const u of users) {
        console.log(`Provisioning ${u.email}...`)

        // 1. Sign Up
        const { data, error } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: {
                data: {
                    full_name: u.name
                }
            }
        })

        if (error) {
            console.error(`Error creating ${u.email}:`, error.message)
        } else {
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                console.log(`${u.email} already exists (likely).`)
            } else {
                console.log(`Success: ${u.email} created. ID: ${data.user?.id}`)
            }
        }
    }
}

provisionUsers()
