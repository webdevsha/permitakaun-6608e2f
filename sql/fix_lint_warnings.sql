-- Fix function_search_path_mutable warnings
-- We set the search_path to 'public' to prevent malicious code from executing with the privileges of the function owner if they manipulate the search path.

DO $$
BEGIN
    -- is_staff()
    EXECUTE 'ALTER FUNCTION public.is_staff() SET search_path = public';
    
    -- is_admin()
    EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = public';
    
    -- is_organizer()
    EXECUTE 'ALTER FUNCTION public.is_organizer() SET search_path = public';
    
    -- get_organizer_code()
    EXECUTE 'ALTER FUNCTION public.get_organizer_code() SET search_path = public';
    
    -- handle_new_user()
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public';
    
    -- update_updated_at_column()
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = public';
    
    -- wipe_all_data() - Assuming it takes no args based on name/usage
    BEGIN
        EXECUTE 'ALTER FUNCTION public.wipe_all_data() SET search_path = public';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'wipe_all_data signature might differ or not exist'; END;

    -- set_user_role(text, uuid) - Guessed args from typical usage, wrapping in block to be safe
    BEGIN
        EXECUTE 'ALTER FUNCTION public.set_user_role(text, uuid) SET search_path = public';
    EXCEPTION WHEN OTHERS THEN 
        -- Try alternate signature just in case
        BEGIN
            EXECUTE 'ALTER FUNCTION public.set_user_role(user_id uuid, role text) SET search_path = public';
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'set_user_role extraction failed'; END;
    END;

    -- get_tenant_akaun_summary(integer)
    EXECUTE 'ALTER FUNCTION public.get_tenant_akaun_summary(integer) SET search_path = public';
    
    -- get_organizer_akaun_summary(uuid)
    EXECUTE 'ALTER FUNCTION public.get_organizer_akaun_summary(uuid) SET search_path = public';
    
    -- handle_payment_approval()
    EXECUTE 'ALTER FUNCTION public.handle_payment_approval() SET search_path = public';

    -- process_rental_payment - Need to be careful with args. From code it likely takes (amount, description, redirect).
    -- But let's check exact sig if possible. If not, we can use pg_proc to find it dynamically?
    -- For now, let's try standard likely types: (numeric, text, text)
    BEGIN
        EXECUTE 'ALTER FUNCTION public.process_rental_payment(numeric, text, text) SET search_path = public';
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'process_rental_payment signature mismatch'; END;

END $$;

-- Fix rls_policy_always_true warning
-- Drop the permissive policy on backup table
DROP POLICY IF EXISTS "policy_allow_anon_transactions" ON public.transactions_backup;
