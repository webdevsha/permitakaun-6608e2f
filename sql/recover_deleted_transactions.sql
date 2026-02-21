-- ============================================================================
-- RECOVER: Accidentally Deleted Transactions from Akaun
-- ============================================================================

-- ============================================================================
-- STEP 1: Check for recently deleted data in organizer_transactions
-- ============================================================================

-- Check if there's a deleted_at column or audit log
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'organizer_transactions'
ORDER BY ordinal_position;

-- Check action_logs for deletion records
SELECT 
    'DELETION LOGS' as info,
    created_at,
    action,
    entity_type,
    entity_id,
    details,
    performed_by
FROM public.action_logs
WHERE action = 'DELETE'
AND entity_type = 'transaction'
ORDER BY created_at DESC
LIMIT 50;

-- Check all recent actions on transactions
SELECT 
    'RECENT ACTIONS' as info,
    created_at,
    action,
    entity_type,
    entity_id,
    details->>'table_source' as table_source,
    details->>'description' as description,
    details->>'amount' as amount,
    performed_by
FROM public.action_logs
WHERE entity_type = 'transaction'
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- STEP 2: Check if there's a backup/recycle bin table
-- ============================================================================

-- Check for any backup or deleted records tables
SELECT 
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name ILIKE '%backup%' 
     OR table_name ILIKE '%deleted%'
     OR table_name ILIKE '%recycle%'
     OR table_name ILIKE '%audit%'
     OR table_name ILIKE '%log%');

-- ============================================================================
-- STEP 3: Get the last known transactions before deletion
-- ============================================================================

-- Check action_logs for UPDATE actions (which might show what was deleted)
SELECT 
    'LAST UPDATES BEFORE DELETE' as info,
    created_at,
    action,
    entity_id,
    details as before_delete_data
FROM public.action_logs
WHERE action IN ('UPDATE', 'CREATE')
AND entity_type = 'transaction'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- STEP 4: Attempt to restore from action_logs details
-- ============================================================================

DO $$
DECLARE
    deleted_record RECORD;
    restored_count INTEGER := 0;
BEGIN
    -- Loop through DELETE actions in action_logs
    FOR deleted_record IN 
        SELECT 
            al.entity_id,
            al.details,
            al.created_at as deleted_at,
            al.performed_by
        FROM public.action_logs al
        WHERE al.action = 'DELETE'
        AND al.entity_type = 'transaction'
        AND al.created_at > NOW() - INTERVAL '24 hours'  -- Last 24 hours
        AND NOT EXISTS (
            SELECT 1 FROM public.organizer_transactions ot 
            WHERE ot.id = al.entity_id
        )
        ORDER BY al.created_at DESC
    LOOP
        -- Try to restore the transaction
        BEGIN
            -- Check if details contains enough info to restore
            IF deleted_record.details ? 'amount' AND deleted_record.details ? 'description' THEN
                INSERT INTO public.organizer_transactions (
                    id,
                    organizer_id,
                    amount,
                    type,
                    category,
                    description,
                    date,
                    status,
                    receipt_url,
                    is_auto_generated,
                    created_at,
                    updated_at
                ) VALUES (
                    deleted_record.entity_id,
                    (deleted_record.details->>'organizer_id')::UUID,
                    (deleted_record.details->>'amount')::DECIMAL,
                    COALESCE(deleted_record.details->>'type', 'income'),
                    COALESCE(deleted_record.details->>'category', 'Lain-lain'),
                    deleted_record.details->>'description',
                    COALESCE((deleted_record.details->>'date')::DATE, (deleted_record.details->>'created_at')::DATE, CURRENT_DATE),
                    COALESCE(deleted_record.details->>'status', 'approved'),
                    deleted_record.details->>'receipt_url',
                    COALESCE((deleted_record.details->>'is_auto_generated')::BOOLEAN, false),
                    COALESCE((deleted_record.details->>'created_at')::TIMESTAMPTZ, deleted_record.deleted_at - INTERVAL '1 second'),
                    NOW()
                )
                ON CONFLICT (id) DO NOTHING;
                
                IF FOUND THEN
                    restored_count := restored_count + 1;
                    RAISE NOTICE 'Restored transaction ID: %', deleted_record.entity_id;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to restore transaction ID %: %', deleted_record.entity_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Total transactions restored: %', restored_count;
END $$;

-- ============================================================================
-- STEP 5: Manual recovery - Create INSERT statements from action_logs
-- ============================================================================

-- Generate INSERT statements for deleted transactions
SELECT 
    'INSERT INTO public.organizer_transactions (
        id, organizer_id, amount, type, category, description, date, status, 
        receipt_url, is_auto_generated, created_at, updated_at
    ) VALUES (
        ' || entity_id || ',
        ''' || COALESCE(details->>'organizer_id', 'NULL') || '''::UUID,
        ' || COALESCE(details->>'amount', '0') || ',
        ''' || COALESCE(details->>'type', 'income') || ''',
        ''' || COALESCE(details->>'category', 'Lain-lain') || ''',
        ''' || REPLACE(COALESCE(details->>'description', ''), '''', '''''') || ''',
        ''' || COALESCE(details->>'date', CURRENT_DATE::TEXT) || '''::DATE,
        ''' || COALESCE(details->>'status', 'approved') || ''',
        ' || CASE WHEN details->>'receipt_url' IS NOT NULL THEN '''' || details->>'receipt_url' || '''' ELSE 'NULL' END || ',
        ' || COALESCE(details->>'is_auto_generated', 'false') || ',
        ''' || COALESCE(details->>'created_at', created_at::TEXT) || '''::TIMESTAMPTZ,
        NOW()
    ) ON CONFLICT (id) DO NOTHING;' as restore_sql
FROM public.action_logs
WHERE action = 'DELETE'
AND entity_type = 'transaction'
AND created_at > NOW() - INTERVAL '7 days'  -- Last 7 days
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 6: Show what was restored
-- ============================================================================

SELECT 
    'RESTORED TRANSACTIONS' as info,
    ot.id,
    ot.date,
    ot.description,
    ot.amount,
    ot.type,
    ot.status,
    o.name as organizer_name,
    ot.created_at as restored_at
FROM public.organizer_transactions ot
JOIN public.organizers o ON o.id = ot.organizer_id
WHERE ot.updated_at > NOW() - INTERVAL '1 minute'  -- Recently updated
ORDER BY ot.updated_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 7: Final count
-- ============================================================================

SELECT 
    'FINAL COUNT' as info,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
    COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
FROM public.organizer_transactions;
