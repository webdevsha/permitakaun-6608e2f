-- check real IDs
SELECT id, full_name, email, organizer_code FROM public.tenants;

-- check transactions
SELECT id, tenant_id, amount, status, type, category FROM public.transactions ORDER BY id DESC LIMIT 10;

-- check organizer
SELECT id, organizer_code, email FROM public.organizers;
