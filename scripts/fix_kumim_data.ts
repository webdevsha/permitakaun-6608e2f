
import { createClient } from '@supabase/supabase-js';

// Credentials - reusing known working ones (or valid format ones)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixData() {
    console.log('=== DATA FIX: Linking Manjaya to ORG002 ===\n');

    // 1. Verify/Create ORG002 for admin@kumim.my
    console.log('1. Checking admin@kumim.my profile...');
    const { data: adminProfile, error: adminError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'admin@kumim.my')
        .single();

    if (adminError || !adminProfile) {
        console.error('CRITICAL: admin@kumim.my profile not found!', adminError);
        return;
    }
    console.log('   FOUND admin:', adminProfile.id);

    // Check if Organizer Record exists for ORG002
    console.log('2. checking ORG002 in organizers table...');
    const { data: org002, error: orgError } = await supabase
        .from('organizers')
        .select('*')
        .eq('organizer_code', 'ORG002')
        .maybeSingle();

    if (!org002) {
        console.log('   ORG002 missing. Creating/Upserting...');
        const { error: insertError } = await supabase
            .from('organizers')
            .upsert({
                profile_id: adminProfile.id,
                email: 'admin@kumim.my',
                organizer_code: 'ORG002',
                name: 'KUMIM',
                address: 'Bandar Tun Razak',
                phone: '0123456789'
            }, { onConflict: 'organizer_code' });

        if (insertError) {
            console.error('   FAILED to create ORG002:', insertError);
        } else {
            console.log('   SUCCESS: ORG002 created/verified.');
        }
    } else {
        console.log('   ORG002 exists:', org002.name);
        // Ensure it's linked to admin
        if (org002.profile_id !== adminProfile.id) {
            console.log('   Updating owner of ORG002 to admin@kumim.my...');
            await supabase.from('organizers').update({ profile_id: adminProfile.id }).eq('id', org002.id);
        }
    }

    // 2. Fix manjaya.solution@gmail.com
    console.log('\n3. Checking manjaya.solution@gmail.com...');
    const { data: staff, error: staffError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'manjaya.solution@gmail.com')
        .maybeSingle();

    if (!staff) {
        console.error('CRITICAL: manjaya.solution@gmail.com profile not found!');
    } else {
        console.log('   FOUND Staff:', staff.email);
        console.log('   Current Role:', staff.role);
        console.log('   Current OrgCode:', staff.organizer_code);

        if (staff.role !== 'staff' || staff.organizer_code !== 'ORG002') {
            console.log('   FIXING staff record...');
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    role: 'staff',
                    organizer_code: 'ORG002'
                })
                .eq('id', staff.id);

            if (updateError) {
                console.error('   FAILED to update staff:', updateError);
            } else {
                console.log('   SUCCESS: Updated role=staff and organizer_code=ORG002');
            }
        } else {
            console.log('   Staff record looks correct.');
        }
    }

    console.log('\n=== FIX COMPLETE ===');
}

fixData().catch(e => console.error('Script Error:', e));
