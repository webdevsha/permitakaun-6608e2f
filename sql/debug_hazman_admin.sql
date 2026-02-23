-- Debug script for Hazman (admin@kumim.my) admin transactions

-- 1. Check Hazman's profile
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.full_name
FROM public.profiles p
WHERE p.email = 'admin@kumim.my';

-- 2. Check if Hazman has an admin record
SELECT 
    a.id as admin_id,
    a.profile_id,
    a.full_name,
    a.organizer_code
FROM public.admins a
JOIN public.profiles p ON p.id = a.profile_id
WHERE p.email = 'admin@kumim.my';

-- 3. Check admin transactions for Hazman (by profile_id)
SELECT 
    at.id,
    at.admin_id,
    at.profile_id,
    at.description,
    at.amount,
    at.type,
    at.category,
    at.date,
    at.status
FROM public.admin_transactions at
JOIN public.profiles p ON p.id = at.profile_id
WHERE p.email = 'admin@kumim.my'
ORDER BY at.date DESC;

-- 4. Check admin transactions for Hazman (by admin_id if exists)
SELECT 
    at.id,
    at.admin_id,
    at.profile_id,
    at.description,
    at.amount,
    at.type,
    at.category,
    at.date,
    at.status
FROM public.admin_transactions at
WHERE at.admin_id IN (
    SELECT a.id FROM public.admins a 
    JOIN public.profiles p ON p.id = a.profile_id 
    WHERE p.email = 'admin@kumim.my'
)
ORDER BY at.date DESC;

-- 5. All admin transactions (to see if any exist)
SELECT COUNT(*) as total_admin_transactions FROM public.admin_transactions;

-- 6. Fix: Create admin record for Hazman if missing
/*
INSERT INTO public.admins (profile_id, full_name, email, organizer_code, status)
SELECT 
    p.id,
    COALESCE(p.full_name, 'Hazman'),
    p.email,
    'ADMIN001',
    'active'
FROM public.profiles p
WHERE p.email = 'admin@kumim.my'
AND NOT EXISTS (
    SELECT 1 FROM public.admins a WHERE a.profile_id = p.id
);
*/

-- 7. Check what columns exist in admin_transactions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;
