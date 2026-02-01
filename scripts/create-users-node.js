
const { createClient } = require('@supabase/supabase-js')

// Hardcoded for script usage
const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDYxODYsImV4cCI6MjA4MTc4MjE4Nn0.ExE_RSna8oYLe4cDr-AWLpHXV8AYjtHmiL3VE2MqyrA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const users = [
        { email: 'manjaya.solution@gmail.com', password: 'pass1234', name: 'Staff Encik Hazman' },
        { email: 'admin@kumim.my', password: 'pass1234', name: 'Hazman' }
    ]

    for (const u of users) {
        console.log(`Creating ${u.email}...`)
        const { data, error } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: {
                data: { full_name: u.name }
            }
        })

        if (error) {
            console.error('Failed:', error.message)
        } else {
            console.log('Success:', data.user?.id)
        }
    }
}

main()
