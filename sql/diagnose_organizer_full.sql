-- COMPREHENSIVE DIAGNOSTIC: Organizer Data Relationships
-- This shows the complete picture of what data exists and what's connected

-- 1. ORGANIZER STATUS
SELECT '=== ORGANIZER ===' as section;
SELECT 
    id,
    email,
    organizer_code,
    created_at
FROM public.organizers
WHERE email = 'organizer@permit.com';

-- 2. LOCATIONS - All locations in system
SELECT '=== ALL LOCATIONS ===' as section;
SELECT 
    id,
    name,
    organizer_id,
    created_at,
    CASE 
        WHEN organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com') THEN 'LINKED TO ORGANIZER'
        WHEN organizer_id IS NULL THEN 'ORPHANED (NULL)'
        ELSE 'LINKED TO OTHER'
    END as status
FROM public.locations
ORDER BY created_at DESC
LIMIT 10;

-- 3. TENANTS - Check Ahmad and others
SELECT '=== TENANTS ===' as section;
SELECT 
    id,
    full_name,
    email,
    organizer_code,
    organizer_id,
    profile_id,
    CASE 
        WHEN organizer_id IN (SELECT id FROM organizers WHERE email = 'organizer@permit.com') THEN 'LINKED TO ORGANIZER'
        WHEN organizer_code = 'ORG001' THEN 'HAS CODE BUT NO LINK'
        ELSE 'OTHER'
    END as status
FROM public.tenants
WHERE full_name LIKE '%Ahmad%' OR organizer_code = 'ORG001'
ORDER BY created_at DESC;

-- 4. TENANT-LOCATION LINKS
SELECT '=== TENANT-LOCATION LINKS ===' as section;
SELECT 
    tl.id,
    t.full_name as tenant_name,
    l.name as location_name,
    tl.status,
    l.organizer_id
FROM public.tenant_locations tl
JOIN public.tenants t ON tl.tenant_id = t.id
JOIN public.locations l ON tl.location_id = l.id
WHERE t.full_name LIKE '%Ahmad%' OR t.organizer_code = 'ORG001'
ORDER BY tl.created_at DESC;

-- 5. TRANSACTIONS
SELECT '=== TRANSACTIONS ===' as section;
SELECT 
    tr.id,
    tr.date,
    tr.description,
    tr.amount,
    tr.category,
    t.full_name as tenant_name,
    t.organizer_code
FROM public.transactions tr
JOIN public.tenants t ON tr.tenant_id = t.id
WHERE t.full_name LIKE '%Ahmad%' OR t.organizer_code = 'ORG001'
ORDER BY tr.date DESC
LIMIT 10;

-- 6. PROFILES - Check if Ahmad has a profile
SELECT '=== PROFILES (Ahmad) ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role
FROM public.profiles p
WHERE p.email LIKE '%ahmad%' OR p.full_name LIKE '%Ahmad%';
