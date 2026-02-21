-- ============================================================================
-- FIX: Organizer Subscription RLS and Support
-- ============================================================================

-- 1. First, check if subscriptions table needs organizer_id column
-- (For now, we'll work with existing schema and use admin_transactions for organizers)

-- 2. Add policy for organizers to view their own records in admin_transactions
DROP POLICY IF EXISTS "Organizer view own admin_transactions" ON public.admin_transactions;

CREATE POLICY "Organizer view own admin_transactions" ON public.admin_transactions
    FOR SELECT TO authenticated
    USING (
        metadata->>'user_id' = auth.uid()::text
        AND metadata->>'user_role' = 'organizer'
    );

-- 3. Add policy for organizers to view organizer_transactions
DROP POLICY IF EXISTS "Organizer view own transactions" ON public.organizer_transactions;

CREATE POLICY "Organizer view own transactions" ON public.organizer_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = organizer_transactions.organizer_id
        )
    );

-- 4. Add policy for organizers to insert their own transactions
DROP POLICY IF EXISTS "Organizer insert own transactions" ON public.organizer_transactions;

CREATE POLICY "Organizer insert own transactions" ON public.organizer_transactions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = organizer_transactions.organizer_id
        )
    );

-- 5. Add policy for organizers to update their own pending transactions
DROP POLICY IF EXISTS "Organizer update own transactions" ON public.organizer_transactions;

CREATE POLICY "Organizer update own transactions" ON public.organizer_transactions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = organizer_transactions.organizer_id
        )
        AND status = 'pending'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.organizers
            WHERE profile_id = auth.uid()
            AND id = organizer_transactions.organizer_id
        )
    );

-- Verify policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('admin_transactions', 'organizer_transactions')
AND policyname LIKE '%Organizer%'
ORDER BY tablename, policyname;

SELECT 'Organizer subscription RLS policies added successfully' as status;
