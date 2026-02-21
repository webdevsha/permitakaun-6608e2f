-- ============================================================================
-- DIAGNOSTIC: Complete Organizer Table Investigation
-- ============================================================================
-- Run this in Supabase SQL Editor to identify the exact issue

-- 1. Check if organizers table has profile_id column OR id column
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'organizers'
ORDER BY ordinal_position;

-- 2. Check the actual CREATE TABLE definition
SELECT 
    pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'organizers'::regclass
AND contype = 'p';  -- Primary key

-- 3. Check current trigger function (what column does it use?)
SELECT 
    proname,
    prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 4. Check for any errors in signup_errors table
SELECT * FROM public.signup_errors ORDER BY created_at DESC LIMIT 10;

-- 5. Check if admin@kumim.my has a profile
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.full_name,
    p.organizer_code
FROM public.profiles p
WHERE p.email = 'admin@kumim.my';

-- 6. Check if admin@kumim.my has an organizer record
SELECT 
    o.id as organizer_id,
    o.name,
    o.email,
    o.organizer_code,
    o.status
FROM public.organizers o
WHERE o.email = 'admin@kumim.my';

-- 7. Check the constraint on status column
SELECT 
    conname,
    pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'organizers'::regclass
AND contype = 'c';  -- Check constraints

-- 8. Test what happens when we try to insert an organizer manually
-- DO $$
-- DECLARE
--     test_id UUID := '00000000-0000-0000-0000-000000000001';
-- BEGIN
--     -- First create a test profile
--     INSERT INTO auth.users (id, email, raw_user_meta_data)
--     VALUES (test_id, 'test_organizer@example.com', '{"role": "organizer", "full_name": "Test Organizer"}'::jsonb)
--     ON CONFLICT DO NOTHING;
--     
--     RAISE NOTICE 'Test complete. Check signup_errors table for any issues.';
-- END $$;
