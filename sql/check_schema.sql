-- Check actual columns in transaction tables

-- organizer_transactions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizer_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- tenant_transactions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- admin_transactions columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'admin_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if Hazman has an organizer record
SELECT o.id, o.profile_id, o.name, o.organizer_code
FROM public.organizers o
WHERE o.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';

-- Check if Hazman has a tenant record
SELECT t.id, t.profile_id, t.full_name
FROM public.tenants t
WHERE t.profile_id = '2c9f0478-cc40-4f89-928f-c5a9180e7b87';
