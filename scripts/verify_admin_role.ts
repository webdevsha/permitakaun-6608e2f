
import { createClient } from '@supabase/supabase-js';

// Credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verify() {
    console.log('=== VERIFYING ADMIN ROLE ===');

    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, organizer_code')
        .eq('email', 'admin@kumim.my')
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Profile:', data);
        if (data.role !== 'admin' && data.role !== 'superadmin') {
            console.log('MISMATCH DETECTED: DB role is', data.role, 'but should be admin/superadmin for RLS to work.');
        } else {
            console.log('Role seems correct.');
        }
    }
}

verify();
