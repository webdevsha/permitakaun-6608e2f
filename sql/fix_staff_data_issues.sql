-- Fix Staff Data Issues
-- Run this to verify and fix staff-related data

-- 1. Check manjaya.solution@gmail.com profile
SELECT 'Staff Profile' as check_type, 
       p.id, 
       p.email, 
       p.full_name, 
       p.role, 
       p.organizer_code,
       o.name as organizer_name
FROM profiles p
LEFT JOIN organizers o ON p.organizer_code = o.organizer_code
WHERE p.email = 'manjaya.solution@gmail.com';

-- 2. Check all staff in ORG002
SELECT 'All ORG002 Staff' as check_type,
       p.id, 
       p.email, 
       p.full_name, 
       p.role, 
       p.organizer_code
FROM profiles p
WHERE p.organizer_code = 'ORG002'
AND p.role = 'staff';

-- 3. Check ORG002 Organizer details
SELECT 'ORG002 Organizer' as check_type,
       o.id,
       o.name,
       o.organizer_code,
       o.email,
       o.status
FROM organizers o
WHERE o.organizer_code = 'ORG002';

-- 4. Check tenants with ORG002
SELECT 'ORG002 Tenants' as check_type,
       t.id,
       t.full_name,
       t.business_name,
       t.organizer_code,
       t.status
FROM tenants t
WHERE t.organizer_code = 'ORG002';

-- 5. Fix manjaya.solution@gmail.com organizer_code if needed
UPDATE profiles 
SET organizer_code = 'ORG002', 
    role = 'staff'
WHERE email = 'manjaya.solution@gmail.com'
AND (organizer_code IS NULL OR organizer_code != 'ORG002' OR role != 'staff');

-- 6. Fix ORG002 organizer name if empty
UPDATE organizers
SET name = 'Hazman Enterprise'
WHERE organizer_code = 'ORG002'
AND (name IS NULL OR name = '');

-- 7. Remove any duplicate staff records for ORG002 (keep only manjaya.solution)
-- First check if there are other staff
SELECT 'Other ORG002 Staff to Review' as check_type,
       p.id, 
       p.email, 
       p.full_name
FROM profiles p
WHERE p.organizer_code = 'ORG002'
AND p.role = 'staff'
AND p.email != 'manjaya.solution@gmail.com';

-- 8. Ensure tenants have correct organizer_code
-- Check tenants that should belong to ORG002
SELECT 'Tenants needing organizer_code fix' as check_type,
       t.id,
       t.full_name,
       t.organizer_code,
       tl.location_id,
       l.organizer_id
FROM tenants t
JOIN tenant_locations tl ON tl.tenant_id = t.id
JOIN locations l ON l.id = tl.location_id
JOIN organizers o ON o.id = l.organizer_id
WHERE o.organizer_code = 'ORG002'
AND t.organizer_code != 'ORG002';

-- Fix those tenants
UPDATE tenants
SET organizer_code = 'ORG002'
WHERE id IN (
    SELECT t.id
    FROM tenants t
    JOIN tenant_locations tl ON tl.tenant_id = t.id
    JOIN locations l ON l.id = tl.location_id
    JOIN organizers o ON o.id = l.organizer_id
    WHERE o.organizer_code = 'ORG002'
    AND (t.organizer_code IS NULL OR t.organizer_code != 'ORG002')
);
