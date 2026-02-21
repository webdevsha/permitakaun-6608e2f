-- ============================================================================
-- ADD: location_id to tenant_payments table
-- ============================================================================
-- This ensures rental payments are correctly linked to the location being rented,
-- so the payment goes to the organizer who owns that location.
-- ============================================================================

-- Add location_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenant_payments' 
        AND column_name = 'location_id'
    ) THEN
        ALTER TABLE public.tenant_payments ADD COLUMN location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added location_id column to tenant_payments';
    ELSE
        RAISE NOTICE 'location_id column already exists in tenant_payments';
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_payments_location_id ON public.tenant_payments(location_id);

-- Update the payment trigger to use location_id for routing
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id INTEGER;
    v_tenant_name TEXT;
    v_location_name TEXT;
BEGIN
    -- First, try to get location_id from the payment record itself (if available)
    v_location_id := NEW.location_id;
    
    -- If no location_id in payment, get the most recent location this tenant is renting
    IF v_location_id IS NULL THEN
        SELECT tl.location_id
        INTO v_location_id
        FROM public.tenant_locations tl
        WHERE tl.tenant_id = NEW.tenant_id
        ORDER BY tl.created_at DESC
        LIMIT 1;
    END IF;
    
    -- Get the organizer from the LOCATION (not tenant's default organizer)
    IF v_location_id IS NOT NULL THEN
        SELECT l.organizer_id, l.name
        INTO v_organizer_id, v_location_name
        FROM public.locations l
        WHERE l.id = v_location_id;
    END IF;
    
    -- Fallback: If still no organizer, use tenant's default organizer
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
    ELSE
        -- Get tenant name for description
        SELECT COALESCE(business_name, full_name)
        INTO v_tenant_name
        FROM public.tenants
        WHERE id = NEW.tenant_id;
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
                'approved',  -- Auto-approved
                COALESCE(NEW.payment_date, CURRENT_DATE),
                'Bayaran Sewa dari: ' || COALESCE(v_tenant_name, 'Penyewa') || 
                    CASE WHEN v_location_name IS NOT NULL THEN ' @ ' || v_location_name ELSE '' END ||
                    ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
                NEW.receipt_url,
                true,
                NEW.is_sandbox,
                NEW.billplz_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;
CREATE TRIGGER on_payment_approved
    AFTER UPDATE ON public.tenant_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

SELECT 'tenant_payments table updated with location_id support' as status;
