/**
 * Utility script to fix tenant records that have email but no profile_id
 * This links existing tenant records to their corresponding auth users
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixTenantLinks() {
    console.log('🔧 Starting tenant profile linking fix...\n')

    // 1. Find all tenants without profile_id but with email
    const { data: unlinkedTenants, error: fetchError } = await supabase
        .from('tenants')
        .select('id, email, full_name')
        .is('profile_id', null)
        .not('email', 'is', null)

    if (fetchError) {
        console.error('❌ Error fetching unlinked tenants:', fetchError)
        return
    }

    if (!unlinkedTenants || unlinkedTenants.length === 0) {
        console.log('✅ No unlinked tenants found. All good!')
        return
    }

    console.log(`Found ${unlinkedTenants.length} unlinked tenant(s):\n`)

    for (const tenant of unlinkedTenants) {
        console.log(`Processing: ${tenant.full_name} (${tenant.email})`)

        // 2. Find the corresponding auth user by email
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

        if (authError) {
            console.error(`  ❌ Error fetching auth users:`, authError.message)
            continue
        }

        const matchingUser = authUsers.users.find(u => u.email === tenant.email)

        if (!matchingUser) {
            console.log(`  ⚠️  No auth user found for ${tenant.email}`)
            continue
        }

        // 3. Link the tenant to the user
        const { error: updateError } = await supabase
            .from('tenants')
            .update({ profile_id: matchingUser.id })
            .eq('id', tenant.id)

        if (updateError) {
            console.error(`  ❌ Failed to link:`, updateError.message)
        } else {
            console.log(`  ✅ Successfully linked to user ${matchingUser.id}`)
        }
    }

    console.log('\n🎉 Tenant linking fix complete!')
}

fixTenantLinks().catch(console.error)
