-- Debug script to find tenant and subscription info
DO $$
DECLARE
    v_tenant_id INTEGER;
    v_profile_id UUID;
    v_email TEXT;
    v_tenant_name TEXT;
BEGIN
    -- Find tenant by name
    SELECT id, profile_id, email, full_name INTO v_tenant_id, v_profile_id, v_email, v_tenant_name
    FROM public.tenants
    WHERE full_name ILIKE '%Shafira jangan delete%' OR business_name ILIKE '%Shafira jangan delete%';

    RAISE NOTICE 'Tenant Found: ID=%, Name=%, Email=%', v_tenant_id, v_tenant_name, v_email;

    -- Check Subscriptions
    RAISE NOTICE '--- Subscriptions ---';
    FOR r IN SELECT * FROM public.subscriptions WHERE tenant_id = v_tenant_id LOOP
        RAISE NOTICE 'Sub ID: %, Status: %, Plan: %', r.id, r.status, r.plan_type;
    END LOOP;

    -- Check Tenant Transactions
    RAISE NOTICE '--- Tenant Transactions (Langganan) ---';
    FOR r IN SELECT * FROM public.tenant_transactions WHERE tenant_id = v_tenant_id AND category = 'Langganan' LOOP
        RAISE NOTICE 'Txn ID: %, Amount: %, Status: %', r.id, r.amount, r.status;
    END LOOP;

     -- Check Admin Transactions (Source)
    RAISE NOTICE '--- Admin Transactions (Potential Source) ---';
    FOR r IN SELECT * FROM public.admin_transactions WHERE category = 'Langganan' AND (metadata->>'payer_email' = v_email OR description ILIKE '%' || v_email || '%') LOOP
         RAISE NOTICE 'Admin Txn ID: %, Amount: %, Status: %, Ref: %', r.id, r.amount, r.status, r.payment_reference;
    END LOOP;

END $$;
