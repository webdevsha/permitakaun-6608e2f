-- Check tenant_payments table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check sample data
SELECT 
    id,
    tenant_id,
    location_id,
    organizer_id,
    organizer_code,
    amount,
    status,
    payment_date
FROM public.tenant_payments
LIMIT 5;
