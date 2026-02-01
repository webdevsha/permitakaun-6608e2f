-- Verify Payment Flow for Ahmad
DO $$
DECLARE
    ahmad_id uuid;
    payment_id uuid;
BEGIN
    SELECT id INTO ahmad_id FROM public.tenants WHERE email = 'ahmad@permit.com';

    IF ahmad_id IS NOT NULL THEN
        -- 1. Insert Payment
        INSERT INTO public.tenant_payments (
            tenant_id,
            amount,
            status,
            payment_date,
            payment_method,
            receipt_url
        ) VALUES (
            ahmad_id,
            50.00,
            'approved',
            CURRENT_DATE,
            'manual',
            'https://placehold.co/600x400?text=Resit+Sewa+Ahmad'
        ) RETURNING id INTO payment_id;

        RAISE NOTICE 'Payment inserted for Ahmad. ID: %', payment_id;
        
        -- The trigger should handle the rest.
        
    ELSE
        RAISE NOTICE 'Ahmad tenant not found.';
    END IF;
END $$;
