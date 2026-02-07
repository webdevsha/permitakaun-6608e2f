-- Check current column type
SELECT 
    column_name,
    data_type,
    udt_name,
    column_default
FROM information_schema.columns
WHERE table_name = 'organizer_transactions'
AND column_name = 'id';

-- If the id column is not uuid, we need to check what type it is
-- and potentially add a uuid column for new transactions

-- Check if there's a uuid column already
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizer_transactions';

-- If id is integer/bigint, let's see recent records
SELECT id, created_at, description, status
FROM organizer_transactions
ORDER BY created_at DESC
LIMIT 5;
