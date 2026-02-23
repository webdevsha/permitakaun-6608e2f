-- Fix admin_transactions with NULL profile_id
-- Link them to Hazman's account

-- 1. Check Hazman's profile ID
SELECT 
    p.id as profile_id,
    p.email,
    p.full_name
FROM public.profiles p
WHERE p.email = 'admin@kumim.my';

-- 2. See ALL admin transactions (including NULL ones)
SELECT 
    at.id,
    at.admin_id,
    at.profile_id,
    at.description,
    at.amount,
    at.date,
    at.created_at
FROM public.admin_transactions at
ORDER BY at.date DESC;

-- 3. FIX: Update all admin_transactions with NULL profile_id 
-- to use Hazman's profile_id
UPDATE public.admin_transactions
SET 
    profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87',
    admin_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
WHERE profile_id IS NULL;

-- 4. Also update any with NULL admin_id but have profile_id
UPDATE public.admin_transactions
SET admin_id = profile_id
WHERE admin_id IS NULL AND profile_id IS NOT NULL;

-- 5. Verify fix
SELECT 
    at.id,
    at.admin_id,
    at.profile_id,
    at.description,
    at.amount,
    at.date
FROM public.admin_transactions at
WHERE at.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87'
ORDER BY at.date DESC;

-- 6. Check count
SELECT COUNT(*) as hazman_transactions 
FROM public.admin_transactions 
WHERE profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';
