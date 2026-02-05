-- Check for database issues that could cause hanging

-- 1. Check for long-running queries (if pg_stat_activity is available)
SELECT '=== ACTIVE CONNECTIONS ===' as section;
SELECT count(*) as connection_count FROM pg_stat_activity WHERE state = 'active';

-- 2. Check profiles table for organizer@permit.com
SELECT '=== ORGANIZER@PERMIT.COM PROFILE ===' as section;
SELECT id, email, role, created_at, organizer_code FROM profiles WHERE email = 'organizer@permit.com';

-- 3. Check organizers table
SELECT '=== ORGANIZERS TABLE ===' as section;
SELECT o.id, o.profile_id, o.name, o.accounting_status, o.organizer_code, p.email 
FROM organizers o 
LEFT JOIN profiles p ON p.id = o.profile_id 
WHERE p.email = 'organizer@permit.com';

-- 4. Check for any locks on key tables
SELECT '=== TABLE LOCKS ===' as section;
SELECT 
    relname as table_name,
    mode,
    granted
FROM pg_locks l 
JOIN pg_class c ON c.oid = l.relation 
WHERE relname IN ('profiles', 'organizers', 'tenants', 'admins', 'staff')
AND mode NOT LIKE '%AccessShare%';

-- 5. Verify RLS policies are working
SELECT '=== RLS POLICIES ON PROFILES ===' as section;
SELECT policyname, permissive, roles, cmd FROM pg_policies WHERE tablename = 'profiles';

-- 6. Check system settings
SELECT '=== SYSTEM SETTINGS ===' as section;
SELECT * FROM system_settings;
