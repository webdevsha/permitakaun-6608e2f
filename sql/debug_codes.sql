-- Debug Codes and Links
SELECT 
    p.email, 
    p.id as profile_id, 
    o.id as org_id, 
    o.organizer_code as org_code_in_organizers_table
FROM public.profiles p
LEFT JOIN public.organizers o ON o.id = p.id
WHERE p.email = 'organizer@permit.com';

SELECT 
    t.id as tenant_id, 
    t.full_name, 
    t.organizer_code as tenant_org_code
FROM public.tenants t
WHERE t.id = 3;
