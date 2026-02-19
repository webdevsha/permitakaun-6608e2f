const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://sfcoqymbxectgwedkbqa.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY29xeW1ieGVjdGd3ZWRrYnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwNjE4NiwiZXhwIjoyMDgxNzgyMTg2fQ.fWBLhPVkGsHzn8U5nYCxcKO7sgStZLWSFbbgRwJKvyM';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runSQL() {
    const sqlFile = path.join(__dirname, '..', 'sql', 'add_foodtruck_and_estimates.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('Running SQL migration...\n');

    // Split SQL into statements and execute one by one
    const statements = sql.split(';').filter(s => s.trim().length > 0);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt || stmt.startsWith('--') || stmt.startsWith('/*')) continue;

        console.log(`Executing: ${stmt.substring(0, 50)}...`);
        try {
            // Try using the rpc first if available
            const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
            if (error) {
                // If RPC fails (e.g. function doesn't exist), we can't easily run DDL via client without it.
                // However, the previous script suggests this might be the way.
                // If exec_sql doesn't exist, we might be stuck unless we use the dashboard.
                // But let's try.
                console.log('   RPC Error:', error.message);
            } else {
                console.log('   ✓ Success');
            }
        } catch (e) {
            console.log('   Exception:', e.message);
        }
    }

    console.log('\nMigration script finished.');
}

runSQL().catch(console.error);
