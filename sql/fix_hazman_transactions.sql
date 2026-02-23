-- Fix Hazman's admin transactions visibility

-- 1. Check Hazman's admin ID
SELECT 
    a.id as admin_id,
    a.profile_id,
    p.email
FROM public.admins a
JOIN public.profiles p ON p.id = a.profile_id
WHERE p.email = 'admin@kumim.my';

-- 2. Check admin transactions structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if Hazman has any transactions (by profile_id)
SELECT 
    at.*
FROM public.admin_transactions at
WHERE at.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
ORDER BY at.date DESC;

-- 4. Check if Hazman has any transactions (by admin_id)
SELECT 
    at.*
FROM public.admin_transactions at
WHERE at.admin_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
ORDER BY at.date DESC;

-- 5. See ALL admin transactions with their admin details
SELECT 
    at.id,
    at.admin_id,
    at.profile_id,
    at.description,
    at.amount,
    at.type,
    at.date,
    at.created_at
FROM public.admin_transactions at
ORDER BY at.date DESC
LIMIT 20;

-- 6. FIX: Update any admin_transactions that have NULL admin_id 
-- to use Hazman's profile_id as admin_id
/*
UPDATE public.admin_transactions
SET admin_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
WHERE admin_id IS NULL 
AND profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';
*/

-- 7. FIX: If admin_transactions use integer IDs but Hazman's admin record uses UUID,
-- we need to check the actual data type
SELECT 
    at.admin_id,
    pg_typeof(at.admin_id) as admin_id_type,
    at.profile_id,
    pg_typeof(at.profile_id) as profile_id_type
FROM public.admin_transactions at
LIMIT 5;
