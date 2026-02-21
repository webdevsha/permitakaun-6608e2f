import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co'
// I need the service role key, but I only have anon key in .env.local.
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDYxODYsImV4cCI6MjA4MTc4MjE4Nn0.ExE_RSna8oYLe4cDr-AWLpHXV8AYjtHmiL3VE2MqyrA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const email = `testorg${Date.now()}@example.com`
    console.log('Testing signup with', email)
    const { data, error } = await supabase.auth.signUp({
        email,
        password: 'Password123!',
        options: {
            data: {
                full_name: 'Test Organizer',
                role: 'organizer'
            }
        }
    })

    if (error) {
        console.log('Signup Error:', error)
    } else {
        console.log('Signup Success:', data.user?.id)
    }
}

main()
