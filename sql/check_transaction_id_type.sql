-- Check the data type of the id column in organizer_transactions
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'organizer_transactions'
AND column_name = 'id';

-- Also check recent transactions to see what the IDs look like
SELECT id, created_at, description, status
FROM organizer_transactions
ORDER BY created_at DESC
LIMIT 10;
