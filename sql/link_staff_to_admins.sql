-- Link Staff to Their Admins via Organizer Code
-- This creates a hierarchy where staff can only see data from their admin's organization

-- 1. Link manjaya.solution@gmail.com to Hazman's organization (ORG002)
UPDATE public.profiles
SET organizer_code = 'ORG002'
WHERE email = 'manjaya.solution@gmail.com';

-- 2. Link staff@permit.com to admin@permit.com's organization (ORG001)
UPDATE public.profiles
SET organizer_code = 'ORG001'
WHERE email = 'staff@permit.com';

-- Verify the updates
SELECT 
    email,
    role,
    organizer_code,
    'Staff linked to organization' as status
FROM public.profiles
WHERE email IN ('manjaya.solution@gmail.com', 'staff@permit.com');
