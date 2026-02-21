-- ============================================================================
-- DIAGNOSTIC: Check organizers table structure and constraints
-- ============================================================================

-- 1. Check all columns in organizers table
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'organizers'
ORDER BY ordinal_position;

-- 2. Check primary key
SELECT 
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'organizers' 
AND tc.constraint_type = 'PRIMARY KEY';

-- 3. Check foreign keys
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'organizers' 
AND tc.constraint_type = 'FOREIGN KEY';

-- 4. Check unique constraints
SELECT 
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'organizers' 
AND tc.constraint_type = 'UNIQUE';

-- 5. Check RLS policies on organizers
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'organizers';

-- 6. Check if RLS is enabled
SELECT 
    relname,
    relrowsecurity,
    relforcerowsecurity
FROM pg_class
WHERE relname = 'organizers';

-- 7. Test inserting an organizer manually (this will show specific constraint errors)
-- DO $$
-- BEGIN
--     INSERT INTO public.organizers (profile_id, email, name, organizer_code, status, created_at, updated_at)
--     VALUES (
--         '00000000-0000-0000-0000-000000000000',
--         'test@example.com',
--         'Test Organizer',
--         'ORG9999',
--         'pending',
--         NOW(),
--         NOW()
--     );
--     RAISE NOTICE 'Test insert successful';
--     -- Clean up
--     DELETE FROM public.organizers WHERE email = 'test@example.com';
-- EXCEPTION
--     WHEN OTHERS THEN
--         RAISE NOTICE 'Test insert failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
-- END $$;

-- 8. Check if there are any NOT NULL constraints causing issues
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'organizers'
AND is_nullable = 'NO';
