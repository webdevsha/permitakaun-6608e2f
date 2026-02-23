-- Update the payment approval trigger to use direct organizer_id from tenant_payments
-- This is more reliable than looking up via organizer_code

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;
DROP FUNCTION IF EXISTS public.handle_payment_approval();

-- Create updated function that uses tenant_payments.organizer_id directly
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id INTEGER;
    v_tenant_name TEXT;
    v_organizer_name TEXT;
BEGIN
    -- Check if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Get tenant name
        SELECT COALESCE(business_name, full_name) 
        INTO v_tenant_name
        FROM public.tenants 
        WHERE id = NEW.tenant_id;
        
        -- Use organizer_id directly from tenant_payments (most reliable)
        v_organizer_id := NEW.organizer_id;
        
        -- Fallback: try to get from location if not set
        IF v_organizer_id IS NULL AND NEW.location_id IS NOT NULL THEN
            SELECT organizer_id INTO v_organizer_id
            FROM public.locations
            WHERE id = NEW.location_id;
        END IF;
        
        -- Fallback: try to get from tenant's organizer_code
        IF v_organizer_id IS NULL THEN
            SELECT o.id INTO v_organizer_id
            FROM public.organizers o
            JOIN public.tenants t ON t.organizer_code = o.organizer_code
            WHERE t.id = NEW.tenant_id;
        END IF;
        
        -- Use location_id directly from tenant_payments
        v_location_id := NEW.location_id;
        
        -- Fallback: get from tenant_locations
        IF v_location_id IS NULL THEN
            SELECT location_id INTO v_location_id
            FROM public.tenant_locations
            WHERE tenant_id = NEW.tenant_id
            AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1;
        END IF;
        
        -- Get organizer name for description
        SELECT name INTO v_organizer_name
        FROM public.organizers
        WHERE id = v_organizer_id;
        
        -- Log for debugging
        RAISE NOTICE '[handle_payment_approval] tenant_id=%, organizer_id=%, location_id=%, amount=%', 
            NEW.tenant_id, v_organizer_id, v_location_id, NEW.amount;
        
        -- Create tenant transaction (expense for tenant) - always create this
        INSERT INTO public.tenant_transactions (
            tenant_id,
            profile_id,
            organizer_id,
            location_id,
            amount,
            type,
            category,
            status,
            date,
            description,
            receipt_url,
            is_rent_payment,
            is_sandbox,
            payment_reference
        ) VALUES (
            NEW.tenant_id,
            (SELECT profile_id FROM public.tenants WHERE id = NEW.tenant_id),
            v_organizer_id,
            v_location_id,
            NEW.amount,
            'expense',
            'Sewa',
            'approved',
            COALESCE(NEW.payment_date, CURRENT_DATE),
            'Bayaran Sewa/Permit (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            NEW.is_sandbox,
            NEW.billplz_id
        );
        
        -- Create organizer transaction ONLY if we have a valid organizer_id
        IF v_organizer_id IS NOT NULL THEN
            INSERT INTO public.organizer_transactions (
                organizer_id,
                tenant_id,
                location_id,
                amount,
                type,
                category,
                status,
                date,
                description,
                receipt_url,
                is_auto_generated,
                is_sandbox,
                payment_reference
            ) VALUES (
                v_organizer_id,
                NEW.tenant_id,
                v_location_id,
                NEW.amount,
                'income',
                'Sewa',
                'approved',
                COALESCE(NEW.payment_date, CURRENT_DATE),
                'Bayaran Sewa dari: ' || COALESCE(v_tenant_name, 'Penyewa') || 
                    CASE WHEN v_organizer_name IS NOT NULL THEN ' (Kepada: ' || v_organizer_name || ')' ELSE '' END ||
                    ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
                NEW.receipt_url,
                true,
                NEW.is_sandbox,
                NEW.billplz_id
            );
            RAISE NOTICE '[handle_payment_approval] Created organizer transaction for organizer_id=%', v_organizer_id;
        ELSE
            RAISE NOTICE '[handle_payment_approval] Skipped organizer transaction - no organizer_id found';
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_payment_approved
    AFTER UPDATE ON public.tenant_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

-- Also create trigger for INSERT (for manual payments that start as approved)
CREATE TRIGGER on_payment_created_approved
    AFTER INSERT ON public.tenant_payments
    FOR EACH ROW
    WHEN (NEW.status = 'approved')
    EXECUTE FUNCTION public.handle_payment_approval();

-- Verify triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'tenant_payments'
AND trigger_schema = 'public';
