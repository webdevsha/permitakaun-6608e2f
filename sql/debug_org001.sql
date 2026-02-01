-- Debug: Find who holds ORG001
SELECT id, name, email, organizer_code 
FROM public.organizers 
WHERE organizer_code = 'ORG001';

-- Debug: Find organizer@permit.com profile and organizer entry
SELECT p.id as profile_id, p.email, o.id as org_id, o.organizer_code
FROM public.profiles p
LEFT JOIN public.organizers o ON o.id = p.id
WHERE p.email = 'organizer@permit.com';
