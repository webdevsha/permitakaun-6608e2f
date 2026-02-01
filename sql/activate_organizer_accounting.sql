-- Check and activate accounting for organizer@permit.com
SELECT 
    o.id,
    o.email,
    o.organizer_code,
    o.accounting_status
FROM public.organizers o
WHERE o.email = 'organizer@permit.com';

-- If accounting_status is not 'active', update it:
UPDATE public.organizers
SET accounting_status = 'active'
WHERE email = 'organizer@permit.com';
