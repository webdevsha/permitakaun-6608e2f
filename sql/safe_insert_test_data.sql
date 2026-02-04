-- Safe SQL that doesn't use ON CONFLICT
-- This avoids the "no unique or exclusion constraint" error

-- Update admin role
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@kumim.my';

-- Link staff
UPDATE public.profiles SET role = 'staff', organizer_code = 'ORG002' WHERE email = 'manjaya.solution@gmail.com';

-- Update tenants without organizer_code
UPDATE public.tenants SET organizer_code = 'ORG002' WHERE organizer_code IS NULL OR organizer_code = '';

-- Show results
SELECT 'Admin' as type, email, role FROM public.profiles WHERE email = 'admin@kumim.my'
UNION ALL
SELECT 'Staff' as type, email, role FROM public.profiles WHERE email = 'manjaya.solution@gmail.com';
