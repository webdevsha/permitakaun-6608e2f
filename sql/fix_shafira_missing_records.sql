-- Fix script for Shafira's missing subscription records
DO $$
DECLARE
    v_tenant_id INTEGER;
    v_profile_id UUID;
    v_email TEXT;
    v_count INTEGER;
    r RECORD;
BEGIN
    -- 1. Find the tenant
    SELECT id, profile_id, email INTO v_tenant_id, v_profile_id, v_email
    FROM public.tenants
    WHERE full_name ILIKE '%Shafira jangan delete%' OR business_name ILIKE '%Shafira jangan delete%'
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Tenant Shafira not found!';
        RETURN;
    END IF;

    RAISE NOTICE 'Found Tenant: % (ID: %)', v_email, v_tenant_id;

    -- 2. Find relevant Admin Transaction (Langganan)
    -- We search for the most recent 'Langganan' income transaction for this user.
    -- If email is in metadata or description.
    
    FOR r IN 
        SELECT * FROM public.admin_transactions 
        WHERE category = 'Langganan' 
        AND type = 'income'
        AND status = 'approved'
        AND (
            metadata->>'payer_email' = v_email 
            OR description ILIKE '%' || v_email || '%'
            OR metadata->>'user_id' = v_profile_id::text
        )
        ORDER BY created_at DESC
        LIMIT 1
    LOOP
        RAISE NOTICE 'Found Admin Transaction: % (Ref: %)', r.id, r.payment_reference;

        -- 3. Insert into subscriptions if missing
        SELECT COUNT(*) INTO v_count FROM public.subscriptions WHERE payment_ref = r.payment_reference;
        IF v_count = 0 THEN
             INSERT INTO public.subscriptions (
                tenant_id,
                plan_type,
                status,
                start_date,
                end_date,
                amount,
                payment_ref,
                created_at,
                updated_at
            ) VALUES (
                v_tenant_id,
                COALESCE(r.metadata->>'plan_type', 'basic'),
                'active',
                r.date,
                (r.date + INTERVAL '30 days'),
                r.amount,
                r.payment_reference,
                r.created_at,
                r.updated_at
            );
            RAISE NOTICE 'Inserted into subscriptions table';
        ELSE
            RAISE NOTICE 'Subscription already exists';
        END IF;

        -- 4. Insert into tenant_transactions if missing
        SELECT COUNT(*) INTO v_count FROM public.tenant_transactions WHERE payment_reference = r.payment_reference;
        IF v_count = 0 THEN
            INSERT INTO public.tenant_transactions (
                tenant_id,
                description,
                amount,
                type,
                category,
                date,
                status,
                payment_method,
                payment_reference,
                receipt_url,
                created_at,
                updated_at
            ) VALUES (
                v_tenant_id,
                r.description,
                r.amount,
                'expense',
                'Langganan',
                r.date,
                'approved',
                r.payment_method,
                r.payment_reference,
                r.receipt_url,
                r.created_at,
                r.updated_at
            );
             RAISE NOTICE 'Inserted into tenant_transactions table';
        ELSE
             RAISE NOTICE 'Tenant Transaction already exists';
        END IF;
    END LOOP;
    
    -- If no admin transaction found, we might need to look deeper or it doesn't exist.
    IF NOT FOUND THEN
        RAISE NOTICE 'No matching approved Admin Transaction found for this user.';
    END IF;

END $$;
