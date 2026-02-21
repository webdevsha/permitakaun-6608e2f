import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDYxODYsImV4cCI6MjA4MTc4MjE4Nn0.ExE_RSna8oYLe4cDr-AWLpHXV8AYjtHmiL3VE2MqyrA'

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.from('organizers').select('*').limit(1)
    if (data && data.length > 0) {
        console.log('Columns in organizers table:', Object.keys(data[0]))
    } else {
        console.log('No data to infer columns from or error:', error)
    }
}

main()
