-- ============================================================================
-- DEBUG: Check what role admin users actually have in profiles table
-- The app uses determineUserRole() which overrides by email,
-- but RLS policies check profiles.role in the database.
-- ============================================================================

-- 1. Check current roles for admin emails
SELECT id, email, role
FROM public.profiles
WHERE email IN ('admin@kumim.my', 'admin@permit.com', 'rafisha92@gmail.com', 'manjaya.solution@gmail.com');

-- 2. Fix: Ensure admin emails have correct roles in the database
-- This makes profiles.role match what determineUserRole() returns
UPDATE public.profiles SET role = 'admin'
WHERE email = 'admin@kumim.my' AND role != 'admin';

UPDATE public.profiles SET role = 'admin'
WHERE email = 'admin@permit.com' AND role != 'admin';

UPDATE public.profiles SET role = 'superadmin'
WHERE email = 'rafisha92@gmail.com' AND role != 'superadmin';

UPDATE public.profiles SET role = 'staff'
WHERE email = 'manjaya.solution@gmail.com' AND role != 'staff';

-- 3. Verify after fix
SELECT id, email, role
FROM public.profiles
WHERE email IN ('admin@kumim.my', 'admin@permit.com', 'rafisha92@gmail.com', 'manjaya.solution@gmail.com');
