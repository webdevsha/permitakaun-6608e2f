-- Backfill specific transaction into tenant_payments
DO $$
DECLARE
    t_id bigint := 3;
    t_amount numeric := 32.00;
    t_date date := '2026-02-01';
    t_status text := 'pending'; -- As provided in JSON
    t_billplz_id text := '5063f79df1b47890';
    t_receipt_url text := 'https://www.billplz-sandbox.com/bills/5063f79df1b47890';
    target_org_code text;
BEGIN
    -- 1. Get Organizer Code for Tenant 3 (Ahmad)
    SELECT organizer_code INTO target_org_code FROM public.tenants WHERE id = t_id;

    -- 2. Insert into tenant_payments if not exists
    IF NOT EXISTS (SELECT 1 FROM public.tenant_payments WHERE billplz_id = t_billplz_id) THEN
        INSERT INTO public.tenant_payments (
            tenant_id, 
            amount, 
            status, 
            payment_date, 
            payment_method, 
            billplz_id, 
            receipt_url, 
            organizer_code
        ) VALUES (
            t_id, 
            t_amount, 
            t_status, 
            t_date, 
            'billplz',
            t_billplz_id, 
            t_receipt_url, 
            target_org_code
        );
        RAISE NOTICE 'Success: Backfilled payment for Billplz ID %', t_billplz_id;
    ELSE
        RAISE NOTICE 'Info: Payment % already exists in tenant_payments.', t_billplz_id;
    END IF;
END $$;
