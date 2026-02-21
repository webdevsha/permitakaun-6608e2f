-- ============================================================================
-- RECOVER: Accidentally Deleted Transactions from Akaun (Version 2)
-- ============================================================================

-- ============================================================================
-- STEP 1: Check action_logs table structure
-- ============================================================================

-- See what columns exist
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'action_logs'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: Check for DELETE actions in action_logs (using correct column names)
-- ============================================================================

-- Check deletion records
SELECT 
    'DELETION LOGS' as info,
    created_at,
    action,
    resource,
    resource_id,
    details,
    user_id as performed_by
FROM public.action_logs
WHERE action = 'DELETE'
AND resource = 'transaction'
ORDER BY created_at DESC
LIMIT 50;

-- Check all recent actions on transactions
SELECT 
    'RECENT ACTIONS' as info,
    created_at,
    action,
    resource,
    resource_id,
    details->>'table_source' as table_source,
    details->>'description' as description,
    details->>'amount' as amount,
    user_id as performed_by
FROM public.action_logs
WHERE resource = 'transaction'
ORDER BY created_at DESC
LIMIT 100;

-- ============================================================================
-- STEP 3: Attempt to restore from action_logs details
-- ============================================================================

DO $$
DECLARE
    deleted_record RECORD;
    restored_count INTEGER := 0;
BEGIN
    -- Loop through DELETE actions in action_logs (last 24 hours)
    FOR deleted_record IN 
        SELECT 
            al.resource_id,
            al.details,
            al.created_at as deleted_at,
            al.user_id as performed_by
        FROM public.action_logs al
        WHERE al.action = 'DELETE'
        AND al.resource = 'transaction'
        AND al.created_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
            SELECT 1 FROM public.organizer_transactions ot 
            WHERE ot.id::TEXT = al.resource_id
        )
        ORDER BY al.created_at DESC
    LOOP
        -- Try to restore the transaction
        BEGIN
            -- Check if details contains enough info to restore
            IF deleted_record.details ? 'amount' AND deleted_record.details ? 'description' THEN
                INSERT INTO public.organizer_transactions (
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
                    (deleted_record.details->>'amount')::DECIMAL,
                    COALESCE(deleted_record.details->>'type', 'income'),
                    COALESCE(deleted_record.details->>'category', 'Lain-lain'),
                    deleted_record.details->>'description',
                    COALESCE((deleted_record.details->>'date')::DATE, CURRENT_DATE),
                    COALESCE(deleted_record.details->>'status', 'approved'),
                    deleted_record.details->>'receipt_url',
                    COALESCE((deleted_record.details->>'is_auto_generated')::BOOLEAN, false),
                    COALESCE((deleted_record.details->>'created_at')::TIMESTAMPTZ, deleted_record.deleted_at - INTERVAL '1 second'),
                    NOW()
                );
                
                IF FOUND THEN
                    restored_count := restored_count + 1;
                    RAISE NOTICE 'Restored transaction: %', deleted_record.details->>'description';
                END IF;
            ELSE
                RAISE NOTICE 'Insufficient data to restore transaction ID: %', deleted_record.resource_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to restore transaction ID %: %', deleted_record.resource_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total transactions restored: %', restored_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- STEP 4: Show what was restored
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
WHERE ot.updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY ot.updated_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 5: Final count
-- ============================================================================

SELECT 
    'FINAL COUNT' as info,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
    COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count,
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
FROM public.organizer_transactions;
