-- Ensure the payment approval trigger correctly creates organizer_transactions
-- for BOTH update (status changed to approved) and insert (manual payment starts approved)
-- Run this in Supabase to guarantee the trigger is in place.

-- Drop all existing variants to start clean
DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;
DROP TRIGGER IF EXISTS on_payment_created_approved ON public.tenant_payments;
DROP FUNCTION IF EXISTS public.handle_payment_approval();

-- Create the definitive trigger function
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id  INTEGER;
    v_tenant_name  TEXT;
    v_org_name     TEXT;
    v_loc_name     TEXT;
BEGIN
    -- Only act when status becomes 'approved' (avoids duplicate runs)
    IF NOT (NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved')) THEN
        RETURN NEW;
    END IF;

    -- Resolve organizer_id: direct from payment, then location, then organizer_code
    v_organizer_id := NEW.organizer_id;

    IF v_organizer_id IS NULL AND NEW.location_id IS NOT NULL THEN
        SELECT organizer_id INTO v_organizer_id
        FROM public.locations WHERE id = NEW.location_id;
    END IF;

    IF v_organizer_id IS NULL THEN
        SELECT o.id INTO v_organizer_id
        FROM public.organizers o
        JOIN public.tenants t ON t.organizer_code = o.organizer_code
        WHERE t.id = NEW.tenant_id
        LIMIT 1;
    END IF;

    -- Resolve location_id
    v_location_id := NEW.location_id;
    IF v_location_id IS NULL THEN
        SELECT location_id INTO v_location_id
        FROM public.tenant_locations
        WHERE tenant_id = NEW.tenant_id AND is_active = true
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Resolve display names
    SELECT COALESCE(business_name, full_name) INTO v_tenant_name
    FROM public.tenants WHERE id = NEW.tenant_id;

    SELECT name INTO v_org_name FROM public.organizers WHERE id = v_organizer_id;

    SELECT name INTO v_loc_name FROM public.locations WHERE id = v_location_id;

    -- -------------------------------------------------------
    -- 1. Create tenant_transaction (expense side for tenant)
    --    Skip if already exists for this payment reference
    -- -------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_transactions
        WHERE tenant_id = NEW.tenant_id
          AND is_rent_payment = true
          AND (
              (NEW.billplz_id IS NOT NULL AND payment_reference = NEW.billplz_id)
              OR (NEW.billplz_id IS NULL AND amount = NEW.amount
                  AND date = COALESCE(NEW.payment_date::date, CURRENT_DATE))
          )
    ) THEN
        INSERT INTO public.tenant_transactions (
            tenant_id, profile_id, organizer_id, location_id,
            amount, type, category, status, date, description,
            receipt_url, is_rent_payment, is_sandbox, payment_reference
        ) VALUES (
            NEW.tenant_id,
            (SELECT profile_id FROM public.tenants WHERE id = NEW.tenant_id),
            v_organizer_id,
            v_location_id,
            NEW.amount,
            'expense',
            'Sewa',
            'approved',
            COALESCE(NEW.payment_date::date, CURRENT_DATE),
            'Bayaran Sewa/Permit' ||
                CASE WHEN v_loc_name IS NOT NULL THEN ' - ' || v_loc_name ELSE '' END ||
                ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            COALESCE(NEW.is_sandbox, false),
            NEW.billplz_id
        );
    END IF;

    -- -------------------------------------------------------
    -- 2. Create organizer_transaction (income side for organizer)
    --    Skip if already exists for this payment reference
    -- -------------------------------------------------------
    IF v_organizer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.organizer_transactions
        WHERE organizer_id = v_organizer_id
          AND tenant_id = NEW.tenant_id
          AND category = 'Sewa'
          AND (
              (NEW.billplz_id IS NOT NULL AND payment_reference = NEW.billplz_id)
              OR (NEW.billplz_id IS NULL AND amount = NEW.amount
                  AND date = COALESCE(NEW.payment_date::date, CURRENT_DATE)
                  AND is_auto_generated = true)
          )
    ) THEN
        INSERT INTO public.organizer_transactions (
            organizer_id, tenant_id, location_id,
            amount, type, category, status, date, description,
            receipt_url, is_auto_generated, is_sandbox, payment_reference
        ) VALUES (
            v_organizer_id,
            NEW.tenant_id,
            v_location_id,
            NEW.amount,
            'income',
            'Sewa',
            'approved',
            COALESCE(NEW.payment_date::date, CURRENT_DATE),
            'Bayaran Sewa dari: ' || COALESCE(v_tenant_name, 'Penyewa') ||
                CASE WHEN v_loc_name IS NOT NULL THEN ' @ ' || v_loc_name ELSE '' END ||
                ' (Kepada: ' || COALESCE(v_org_name, 'Organizer') || ')' ||
                ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            COALESCE(NEW.is_sandbox, false),
            NEW.billplz_id
        );

        RAISE NOTICE '[handle_payment_approval] Created organizer_transaction for organizer_id=% tenant_id=%',
            v_organizer_id, NEW.tenant_id;
    ELSE
        RAISE NOTICE '[handle_payment_approval] organizer_transaction already exists or no organizer_id, skipping';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- UPDATE trigger: when status changes to 'approved'
CREATE TRIGGER on_payment_approved
    AFTER UPDATE ON public.tenant_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

-- INSERT trigger: for manual payments inserted directly with status='approved'
CREATE TRIGGER on_payment_created_approved
    AFTER INSERT ON public.tenant_payments
    FOR EACH ROW
    WHEN (NEW.status = 'approved')
    EXECUTE FUNCTION public.handle_payment_approval();

-- Verify both triggers exist
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'tenant_payments'
  AND trigger_schema = 'public'
ORDER BY trigger_name;
