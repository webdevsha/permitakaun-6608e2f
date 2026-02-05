-- =============================================================================
-- DATABASE ARCHITECTURE FIX
-- Proper separation: Profiles (users) vs Tenants (businesses)
-- =============================================================================

-- =============================================================================
-- STEP 1: DIAGNOSTIC - Show what's currently wrong
-- =============================================================================

SELECT '=== CURRENT DATABASE STATE ===' as info;

-- Show profiles (should be: users with roles)
SELECT 
    'PROFILES' as table_name,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code
FROM profiles p
ORDER BY p.role, p.email;

-- Show tenants (should be: ONLY actual businesses, not admins/staff)
SELECT 
    'TENANTS (should only be businesses)' as table_name,
    t.id,
    t.full_name,
    t.email,
    t.organizer_code,
    p.role as linked_profile_role
FROM tenants t
LEFT JOIN profiles p ON p.id = t.profile_id
ORDER BY t.organizer_code, t.full_name;

-- =============================================================================
-- STEP 2: CLEAN UP - Remove non-tenant records from tenants table
-- Admins, Staff, Organizers should NOT be in tenants table!
-- =============================================================================

-- Show records that will be deleted (admins, staff, organizers in tenants table)
SELECT 
    'WILL BE REMOVED FROM TENANTS' as action,
    t.id,
    t.full_name,
    t.email,
    p.role as actual_role,
    t.organizer_code
FROM tenants t
JOIN profiles p ON p.id = t.profile_id
WHERE p.role IN ('admin', 'staff', 'organizer', 'superadmin')
   OR t.email IN ('admin@permit.com', 'admin@kumim.my', 'manjaya.solution@gmail.com', 'organizer@permit.com');

-- DELETE non-tenant records from tenants table
DELETE FROM tenants
WHERE id IN (
    SELECT t.id
    FROM tenants t
    JOIN profiles p ON p.id = t.profile_id
    WHERE p.role IN ('admin', 'staff', 'organizer', 'superadmin')
       OR t.email IN ('admin@permit.com', 'admin@kumim.my', 'manjaya.solution@gmail.com', 'organizer@permit.com')
);

-- =============================================================================
-- STEP 3: VERIFY - Tenants table should now only have actual businesses
-- =============================================================================

SELECT 
    'TENANTS AFTER CLEANUP' as check_type,
    t.id,
    t.full_name,
    t.business_name,
    t.email,
    t.organizer_code
FROM tenants t
ORDER BY t.organizer_code, t.full_name;

-- =============================================================================
-- STEP 4: VERIFY PROFILES - Should have all users with correct roles
-- =============================================================================

SELECT 
    'PROFILES (USERS)' as check_type,
    p.email,
    p.full_name,
    p.role,
    p.organizer_code,
    CASE 
        WHEN p.role = 'admin' THEN 'Manages organizer'
        WHEN p.role = 'staff' THEN 'Helps admin'
        WHEN p.role = 'organizer' THEN 'Manages locations'
        WHEN p.role = 'tenant' THEN 'Is a business'
        ELSE 'Other'
    END as role_purpose
FROM profiles p
ORDER BY p.role, p.email;

-- =============================================================================
-- STEP 5: VERIFY RELATIONSHIPS
-- =============================================================================

-- Show admin-staff relationship
SELECT 
    'ADMIN-STAFF RELATIONSHIP' as relationship,
    admin.email as admin_email,
    admin.full_name as admin_name,
    admin.organizer_code as shared_org_code,
    staff.email as staff_email,
    staff.full_name as staff_name
FROM profiles admin
JOIN profiles staff ON staff.organizer_code = admin.organizer_code
WHERE admin.role = 'admin'
AND staff.role = 'staff'
ORDER BY admin.organizer_code;

-- Show organizer-tenant relationship
SELECT 
    'ORGANIZER-TENANT RELATIONSHIP' as relationship,
    o.organizer_code,
    o.name as organizer_name,
    COUNT(t.id) as tenant_count,
    STRING_AGG(t.full_name, ', ') as tenants
FROM organizers o
LEFT JOIN tenants t ON t.organizer_code = o.organizer_code
GROUP BY o.organizer_code, o.name
ORDER BY o.organizer_code;

-- =============================================================================
-- STEP 6: FINAL VERIFICATION
-- =============================================================================

SELECT '=== FINAL DATABASE ARCHITECTURE ===' as info;

-- Count by table
SELECT 
    'SUMMARY' as check_type,
    (SELECT COUNT(*) FROM profiles WHERE role = 'admin') as admin_count,
    (SELECT COUNT(*) FROM profiles WHERE role = 'staff') as staff_count,
    (SELECT COUNT(*) FROM profiles WHERE role = 'organizer') as organizer_count,
    (SELECT COUNT(*) FROM profiles WHERE role = 'tenant') as tenant_profile_count,
    (SELECT COUNT(*) FROM tenants) as tenants_table_count,
    (SELECT COUNT(*) FROM organizers) as organizers_count;
