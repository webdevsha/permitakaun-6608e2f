-- ============================================================================
-- FIX: Admin Approval RLS Policies for Peniaga & Sewa
-- ============================================================================

-- 1. Add UPDATE policy for tenant_locations (Admin/Staff can approve/reject)
DROP POLICY IF EXISTS "Admin update tenant_locations" ON public.tenant_locations;
DROP POLICY IF EXISTS "Staff update tenant_locations" ON public.tenant_locations;

CREATE POLICY "Admin update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Staff update tenant_locations" ON public.tenant_locations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'staff'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'staff'
        )
    );

-- 2. Add UPDATE policy for tenant_organizers (Admin/Staff can approve/reject)
DROP POLICY IF EXISTS "Admin update tenant_organizers" ON public.tenant_organizers;
DROP POLICY IF EXISTS "Staff update tenant_organizers" ON public.tenant_organizers;

CREATE POLICY "Admin update tenant_organizers" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Staff update tenant_organizers" ON public.tenant_organizers
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'staff'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'staff'
        )
    );

-- 3. Ensure tenant_payments has proper UPDATE policies for admin
DROP POLICY IF EXISTS "Admin update tenant_payments" ON public.tenant_payments;

CREATE POLICY "Admin update tenant_payments" ON public.tenant_payments
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'superadmin')
        )
    );

-- 4. Verify policies were created
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('tenant_locations', 'tenant_organizers', 'tenant_payments')
AND cmd = 'UPDATE'
ORDER BY tablename, policyname;

SELECT 'Admin/Staff UPDATE policies added successfully' as status;
