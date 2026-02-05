-- COMPREHENSIVE FIX: Staff-Admin Relationships
-- This script ensures staff correctly mirror their admin's data

-- ============================================================================
-- PART 1: VERIFY AND FIX STAFF PROFILES
-- ============================================================================

-- 1.1 Fix staff@permit.com (should mirror admin@permit.com / ORG001)
UPDATE profiles 
SET 
    role = 'staff',
    organizer_code = 'ORG001',
    full_name = 'Staff Permit'
WHERE email = 'staff@permit.com'
AND (role != 'staff' OR organizer_code IS NULL OR organizer_code != 'ORG001');

-- 1.2 Fix manjaya.solution@gmail.com (should mirror admin@kumim.my / ORG002)
UPDATE profiles 
SET 
    role = 'staff',
    organizer_code = 'ORG002',
    full_name = 'Staff Encik Hazman'
WHERE email = 'manjaya.solution@gmail.com'
AND (role != 'staff' OR organizer_code IS NULL OR organizer_code != 'ORG002');

-- ============================================================================
-- PART 2: VERIFY STAFF-ADMIN LINKAGES
-- ============================================================================

-- Check staff@permit.com linkage
SELECT 
    'staff@permit.com' as staff_email,
    p.organizer_code as staff_org_code,
    a.email as admin_email,
    a.full_name as admin_name
FROM profiles p
LEFT JOIN profiles a ON a.organizer_code = p.organizer_code AND a.role = 'admin'
WHERE p.email = 'staff@permit.com';

-- Check manjaya.solution@gmail.com linkage  
SELECT 
    'manjaya.solution@gmail.com' as staff_email,
    p.organizer_code as staff_org_code,
    a.email as admin_email,
    a.full_name as admin_name
FROM profiles p
LEFT JOIN profiles a ON a.organizer_code = p.organizer_code AND a.role = 'admin'
WHERE p.email = 'manjaya.solution@gmail.com';

-- ============================================================================
-- PART 3: FIX ORGANIZER NAMES
-- ============================================================================

-- Ensure ORG001 has proper name
UPDATE organizers
SET name = 'Permit System Admin'
WHERE organizer_code = 'ORG001'
AND (name IS NULL OR name = '');

-- Ensure ORG002 has proper name
UPDATE organizers
SET name = 'Hazman Enterprise'
WHERE organizer_code = 'ORG002'
AND (name IS NULL OR name = '');

-- ============================================================================
-- PART 4: VERIFY DATA VISIBILITY
-- ============================================================================

-- Check what staff@permit.com should see (ORG001 data)
SELECT 
    'staff@permit.com visible organizers' as check_type,
    o.name, o.organizer_code
FROM organizers o
WHERE o.organizer_code = 'ORG001';

-- Check what manjaya.solution@gmail.com should see (ORG002 data)
SELECT 
    'manjaya.solution@gmail.com visible organizers' as check_type,
    o.name, o.organizer_code
FROM organizers o
WHERE o.organizer_code = 'ORG002';

-- Check tenant counts per org
SELECT 
    organizer_code,
    COUNT(*) as tenant_count
FROM tenants
WHERE organizer_code IN ('ORG001', 'ORG002')
GROUP BY organizer_code;

-- Check location counts per org
SELECT 
    o.organizer_code,
    COUNT(l.id) as location_count
FROM organizers o
LEFT JOIN locations l ON l.organizer_id = o.id
WHERE o.organizer_code IN ('ORG001', 'ORG002')
GROUP BY o.organizer_code;

-- ============================================================================
-- PART 5: FIX RLS POLICIES FOR STAFF
-- ============================================================================

-- Ensure staff can view their admin's data
-- Drop existing staff policies if they exist
DROP POLICY IF EXISTS "Staff view organizers" ON public.organizers;
DROP POLICY IF EXISTS "Staff view locations" ON public.locations;
DROP POLICY IF EXISTS "Staff view tenants" ON public.tenants;

-- Staff can view organizers with matching organizer_code
CREATE POLICY "Staff view organizers" ON public.organizers
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND p.organizer_code = organizers.organizer_code
    )
);

-- Staff can view locations of their organizer
CREATE POLICY "Staff view locations" ON public.locations
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN organizers o ON o.organizer_code = p.organizer_code
        WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND locations.organizer_id = o.id
    )
);

-- Staff can view tenants with matching organizer_code
CREATE POLICY "Staff view tenants" ON public.tenants
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'staff'
        AND p.organizer_code = tenants.organizer_code
    )
);

-- ============================================================================
-- PART 6: VERIFICATION SUMMARY
-- ============================================================================

SELECT 'STAFF-ADMIN RELATIONSHIP SUMMARY' as report;

SELECT 
    p.email as staff_email,
    p.full_name as staff_name,
    p.organizer_code,
    a.email as admin_email,
    a.full_name as admin_name,
    o.name as organizer_name
FROM profiles p
LEFT JOIN profiles a ON a.organizer_code = p.organizer_code AND a.role = 'admin'
LEFT JOIN organizers o ON o.organizer_code = p.organizer_code
WHERE p.role = 'staff'
ORDER BY p.organizer_code;
