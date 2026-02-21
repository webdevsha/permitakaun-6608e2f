-- ============================================================================
-- FIX: Rental Payment Trigger - Payment goes to Location's Organizer
-- ============================================================================
-- This fix ensures:
-- 1. Rental payments go to the organizer who owns the LOCATION (not tenant's default organizer)
-- 2. Rental payments are auto-approved (no manual approval needed)
-- 3. Organizer's Akaun shows the income transaction correctly
-- ============================================================================

-- Update the payment approval trigger to correctly route payments
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id INTEGER;
    v_tenant_name TEXT;
    v_location_name TEXT;
BEGIN
    -- Get the most recent location this tenant is renting at
    -- We use tenant_locations to find the location, then get that location's organizer
    SELECT 
        tl.location_id,
        l.organizer_id,
        COALESCE(t.business_name, t.full_name)
    INTO 
        v_location_id,
        v_organizer_id,
        v_tenant_name
    FROM public.tenant_locations tl
    JOIN public.locations l ON l.id = tl.location_id
    JOIN public.tenants t ON t.id = tl.tenant_id
    WHERE tl.tenant_id = NEW.tenant_id
    ORDER BY tl.created_at DESC
    LIMIT 1;
    
    -- Fallback: If no location found via tenant_locations, try tenant's default organizer
    IF v_organizer_id IS NULL THEN
        SELECT 
            o.id,
            COALESCE(t.business_name, t.full_name)
        INTO 
            v_organizer_id,
            v_tenant_name
        FROM public.tenants t
        JOIN public.organizers o ON o.organizer_code = t.organizer_code
        WHERE t.id = NEW.tenant_id;
    END IF;
    
    -- Get location name for description
    IF v_location_id IS NOT NULL THEN
        SELECT name INTO v_location_name
        FROM public.locations
        WHERE id = v_location_id;
    END IF;

    -- Check if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Create tenant transaction (expense for tenant)
        INSERT INTO public.tenant_transactions (
            tenant_id,
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
            v_organizer_id,
            v_location_id,
            NEW.amount,
            'expense',
            'Sewa',
            'approved',  -- Auto-approved for rental payments
            COALESCE(NEW.payment_date, CURRENT_DATE),
            'Bayaran Sewa/Permit' || 
                CASE WHEN v_location_name IS NOT NULL THEN ' - ' || v_location_name ELSE '' END ||
                ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            NEW.is_sandbox,
            NEW.billplz_id
        );

        -- Create organizer transaction (income for organizer)
        -- This ensures the organizer's Akaun shows the income
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
                'income',  -- Income for organizer
                'Sewa',
                'approved',  -- Auto-approved
                COALESCE(NEW.payment_date, CURRENT_DATE),
                'Bayaran Sewa dari: ' || COALESCE(v_tenant_name, 'Penyewa') || 
                    CASE WHEN v_location_name IS NOT NULL THEN ' @ ' || v_location_name ELSE '' END ||
                    ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
                NEW.receipt_url,
                true,  -- Auto-generated
                NEW.is_sandbox,
                NEW.billplz_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists on tenant_payments
DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;
CREATE TRIGGER on_payment_approved
    AFTER UPDATE ON public.tenant_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

-- ============================================================================
-- ALSO FIX: Public Payment Transactions (organizer_transactions from bayar page)
-- ============================================================================
-- For public payments via /bayar page, ensure they are auto-approved
-- The payment callback should update the status

-- Fix existing pending rental transactions to approved
-- (Only for transactions that have a receipt_url indicating payment was made)
UPDATE public.organizer_transactions
SET status = 'approved'
WHERE category = 'Sewa'
AND status = 'pending'
AND receipt_url IS NOT NULL;

UPDATE public.tenant_transactions
SET status = 'approved'
WHERE category = 'Sewa'
AND status = 'pending'
AND receipt_url IS NOT NULL;

SELECT 'Rental payment trigger fixed successfully' as status;
