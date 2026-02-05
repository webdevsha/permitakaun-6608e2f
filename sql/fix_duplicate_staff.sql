-- FIX: Remove duplicate staff and ensure only 1 staff per admin

-- Step 1: Identify the primary staff for ORG002 (keep manjaya.solution@gmail.com)
-- Step 2: Delete any other staff with ORG002

-- First, let's see what we're working with
SELECT 
    'BEFORE FIX' as status,
    p.id,
    p.email,
    p.full_name,
    p.organizer_code,
    p.created_at
FROM profiles p
WHERE p.role = 'staff'
AND p.organizer_code = 'ORG002'
ORDER BY p.created_at;

-- DELETE any duplicate staff for ORG002 (keeping manjaya.solution@gmail.com)
-- WARNING: Only run this if you're sure you want to delete!
-- Uncomment the next block to execute:

/*
DELETE FROM profiles
WHERE id IN (
    SELECT p.id
    FROM profiles p
    WHERE p.role = 'staff'
    AND p.organizer_code = 'ORG002'
    AND p.email != 'manjaya.solution@gmail.com'
);
*/

-- Alternative: Instead of deleting, set their role to 'tenant' or update organizer_code
-- This is safer than deletion:

-- Option A: Change duplicate staff to tenant role
/*
UPDATE profiles
SET role = 'tenant'
WHERE role = 'staff'
AND organizer_code = 'ORG002'
AND email != 'manjaya.solution@gmail.com';
*/

-- Option B: Set duplicate staff to a different organizer_code
/*
UPDATE profiles
SET organizer_code = 'ORG999'  -- dummy code
WHERE role = 'staff'
AND organizer_code = 'ORG002'
AND email != 'manjaya.solution@gmail.com';
*/

-- After fix, verify count
SELECT 
    'AFTER FIX' as status,
    COUNT(*) as staff_count
FROM profiles
WHERE role = 'staff'
AND organizer_code = 'ORG002';
