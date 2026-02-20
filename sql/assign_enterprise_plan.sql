-- Assign Enterprise Plan to nshfnoh@proton.me for testing

DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id int;
BEGIN
  -- 1. Find User ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nshfnoh@proton.me';
  
  -- 2. Find Tenant ID
  SELECT id INTO v_tenant_id FROM public.tenants WHERE profile_id = v_user_id;

  IF v_tenant_id IS NOT NULL THEN
    -- 3. Delete old subscription if exists
    DELETE FROM public.subscriptions WHERE tenant_id = v_tenant_id;
    
    -- 4. Insert active Enterprise subscription
    INSERT INTO public.subscriptions (
      tenant_id, 
      plan_type, 
      status, 
      start_date, 
      end_date, 
      amount, 
      payment_ref
    )
    VALUES (
      v_tenant_id,
      'premium', -- Maps to Enterprise
      'active',
      now(),
      now() + interval '30 days',
      19.00,
      'test_enterprise_123'
    );
    
    -- 5. Ensure accounting status is active
    UPDATE public.tenants SET accounting_status = 'active' WHERE id = v_tenant_id;
    
    RAISE NOTICE 'Successfully assigned Enterprise plan to nshfnoh@proton.me (Tenant ID: %)', v_tenant_id;
  ELSE
    RAISE NOTICE 'Tenant not found for nshfnoh@proton.me';
  END IF;
  
END $$;
