
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://sfcoqymbxectgwedkbqa.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDYxODYsImV4cCI6MjA4MTc4MjE4Nn0.ExE_RSna8oYLe4cDr-AWLpHXV8AYjtHmiL3VE2MqyrA"

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('--- Organizers ---')
    const { data: orgs, error: orgError } = await supabase.from('organizers').select('id, organizer_code, name, status, profile_id')
    if (orgError) console.error("Error fetching organizers:", orgError)
    else console.table(orgs)

    console.log('\n--- Active Locations ---')
    const { data: locs, error: locError } = await supabase
        .from('locations')
        .select('id, name, status, organizer_id')
        .eq('status', 'active')

    if (locError) console.error("Error fetching locations:", locError)
    else {
        console.table(locs)
        if (!locs || locs.length === 0) console.log("No active locations found.")
    }

    console.log('\n--- Tenants (with Organizer Code) ---')
    const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('id, business_name, organizer_code, profile_id')
        .not('organizer_code', 'is', null)
        .limit(10)

    if (tenantError) console.error("Error fetching tenants:", tenantError)
    else {
        console.table(tenants)
        if (!tenants || tenants.length === 0) console.log("No tenants with organizer_code found.")
    }
}

debug()
