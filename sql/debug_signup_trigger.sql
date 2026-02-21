-- Debug signup trigger issues

-- 1. Check if sequence exists and current value
SELECT 
    sequencename,
    last_value,
    start_value
FROM pg_sequences 
WHERE sequencename = 'organizer_code_seq';

-- 2. Check organizers table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'organizers'
ORDER BY ordinal_position;

-- 3. Check if trigger exists and is enabled
SELECT 
    tgname,
    tgrelid::regclass,
    tgenabled,
    proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'on_auth_user_created';

-- 4. Test the sequence manually
SELECT 'ORG' || nextval('organizer_code_seq') as test_code;

-- 5. Check for any constraints on organizers table
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'organizers'::regclass;

-- 6. Check if there's a default value on organizer_code column
SELECT 
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'organizers' 
AND column_name = 'organizer_code';

-- 7. Test inserting an organizer manually (will fail if constraints not met, but shows error)
-- DO $$
-- DECLARE
--     test_code TEXT;
-- BEGIN
--     test_code := 'ORG' || nextval('organizer_code_seq');
--     RAISE NOTICE 'Generated code: %', test_code;
-- END $$;
