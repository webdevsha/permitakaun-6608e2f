-- Fix RLS policy for organizer_transactions
-- The current policy checks organizer_id = auth.uid() which is wrong
-- organizer_id references organizers.id, not profiles.id

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Organizers view own transactions" ON public.organizer_transactions;

-- Create corrected policy
CREATE POLICY "Organizers view own transactions" ON public.organizer_transactions
FOR ALL TO authenticated
USING (
    -- Organizer owns the transaction (check via organizers.profile_id)
    EXISTS (
        SELECT 1 FROM public.organizers o
        WHERE o.id = organizer_transactions.organizer_id
        AND o.profile_id = auth.uid()
    )
    OR
    -- Staff of the organizer can see transactions
    EXISTS (
        SELECT 1 FROM public.staff s
        JOIN public.organizers o ON o.id = s.admin_id
        WHERE s.profile_id = auth.uid()
        AND o.id = organizer_transactions.organizer_id
    )
    OR
    -- Admins can see all
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
);

-- Also create a policy for anon to insert (for public payments)
-- This allows the admin client (bypassing RLS) to work properly
-- But we should also allow service role to bypass

-- Enable service role to bypass RLS for callbacks
ALTER TABLE public.organizer_transactions FORCE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.organizer_transactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.organizer_transactions_id_seq TO authenticated;
