
import { createClient } from '@supabase/supabase-js';

// Credentials - reusing known working ones
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixAdminRole() {
    console.log('=== FIX: Setting admin@kumim.my role to ADMIN ===\n');

    // 1. Check current role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', 'admin@kumim.my')
        .single();

    console.log('Current DB Role:', profile?.role);

    if (profile?.role !== 'admin') {
        // 2. Update to admin
        console.log('Updating to admin...');
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('email', 'admin@kumim.my');

        if (error) {
            console.error('Error updating role:', error);
        } else {
            console.log('SUCCESS: admin@kumim.my is now an ADMIN in the database.');
            console.log('This should satisfy the RLS policy: is_admin()');
        }
    } else {
        console.log('Role is already admin. No change needed.');
    }

    // 3. Just to be sure, create/ensure ORG002 linkage again (fix_kumim_data did this, but safe to repeat)
    console.log('\nVerifying ORG002 linkage...');
    const { error: orgError } = await supabase
        .from('profiles')
        .update({ organizer_code: 'ORG002' })
        .eq('email', 'admin@kumim.my');

    if (!orgError) console.log('Linkage Verified.');
}

fixAdminRole().catch(console.error);
