-- ============================================================================
-- COMPLETE FIX: Admin Approval for Peniaga & Sewa
-- ============================================================================

-- ============================================================================
-- PART 1: RLS Policies - Allow Admin/Staff to Approve
-- ============================================================================

-- Tenant Locations UPDATE policies
DROP POLICY IF EXISTS "Admin update tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Staff update tenant_locations" ON public.tenant_locations;

CREATE POLICY "Admin update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Staff update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'));

-- Tenant Organizers UPDATE policies  
DROP POLICY IF EXISTS "Admin update tenant_organizers" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Staff update tenant_organizers" ON public.tenant_organizers;

CREATE POLICY "Admin update tenant_organizers" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

CREATE POLICY "Staff update tenant_organizers" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'staff'));

-- Tenant Payments UPDATE policies
DROP POLICY IF EXISTS "Admin update tenant_payments" ON public.tenant_payments;

CREATE POLICY "Admin update tenant_payments" ON public.tenant_payments
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- ============================================================================
-- PART 2: Fixed Trigger for Payment Approval with Better Error Handling
-- ============================================================================

DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;
DROP FUNCTION IF EXISTS public.handle_payment_approval();

CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id INTEGER;
    v_tenant_name TEXT;
    v_organizer_code TEXT;
BEGIN
    -- Check if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Get tenant name
        SELECT COALESCE(business_name, full_name) 
        INTO v_tenant_name
        FROM public.tenants 
        WHERE id = NEW.tenant_id;
        
        -- Get organizer_code from tenant
        SELECT organizer_code 
        INTO v_organizer_code
        FROM public.tenants 
        WHERE id = NEW.tenant_id;
        
        -- Get organizer_id from organizer_code
        SELECT id INTO v_organizer_id
        FROM public.organizers
        WHERE organizer_code = v_organizer_code;
        
        -- Get location_id from tenant_locations
        SELECT location_id INTO v_location_id
        FROM public.tenant_locations
        WHERE tenant_id = NEW.tenant_id
        AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Log for debugging
        RAISE NOTICE '[handle_payment_approval] tenant_id=%, organizer_code=%, organizer_id=%, location_id=%', 
            NEW.tenant_id, v_organizer_code, v_organizer_id, v_location_id;
        
        -- Create tenant transaction (expense for tenant) - always create this
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
                'Bayaran dari: ' || COALESCE(v_tenant_name, 'Penyewa') || ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
                NEW.receipt_url,
                true,
                NEW.is_sandbox,
                NEW.billplz_id
            );
            RAISE NOTICE '[handle_payment_approval] Created organizer transaction';
        ELSE
            RAISE NOTICE '[handle_payment_approval] Skipped organizer transaction - no organizer_id found';
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_approved
    AFTER UPDATE ON public.tenant_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

-- ============================================================================
-- PART 3: Function to Handle Location Approval (Create Initial Transaction Record)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_location_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- When a location is approved, ensure the tenant has proper linking
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Get organizer_id from location
        DECLARE
            v_location_organizer_id UUID;
        BEGIN
            SELECT organizer_id INTO v_location_organizer_id
            FROM public.locations
            WHERE id = NEW.location_id;
            
            -- Update tenant_locations with organizer_id if not set
            IF NEW.organizer_id IS NULL AND v_location_organizer_id IS NOT NULL THEN
                NEW.organizer_id := v_location_organizer_id;
            END IF;
        END;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger for location approval
DROP TRIGGER IF EXISTS on_location_approved ON public.tenant_locations;

CREATE TRIGGER on_location_approved
    BEFORE UPDATE ON public.tenant_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_location_approval();

-- ============================================================================
-- PART 4: Verify Everything
-- ============================================================================

SELECT 'UPDATE policies created:' as section;
SELECT tablename, policyname, roles::text
FROM pg_policies
WHERE tablename IN ('tenant_locations', 'tenant_organizers', 'tenant_payments')
AND cmd = 'UPDATE';

SELECT 'Triggers created:' as section;
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname IN ('on_payment_approved', 'on_location_approved');

SELECT 'Admin approval system fixed successfully!' as status;
