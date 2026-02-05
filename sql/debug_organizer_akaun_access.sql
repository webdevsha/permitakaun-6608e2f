-- Debug organizer@permit.com Akaun access issues

SELECT '=== ORGANIZER@PERMIT.COM PROFILE ===' as section;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.created_at,
    p.organizer_code,
    -- Calculate days since creation
    EXTRACT(DAY FROM (NOW() - p.created_at)) as days_since_created,
    -- Show current timestamp
    NOW() as current_time
FROM profiles p
WHERE p.email = 'organizer@permit.com';

SELECT '=== ORGANIZER RECORD ===' as section;
SELECT 
    o.id,
    o.profile_id,
    o.organizer_code,
    o.name,
    o.accounting_status,
    o.status
FROM organizers o
WHERE o.profile_id = (SELECT id FROM profiles WHERE email = 'organizer@permit.com');

SELECT '=== SYSTEM TRIAL SETTINGS ===' as section;
SELECT 
    key,
    value
FROM system_settings
WHERE key = 'trial_period_days';

SELECT '=== TENANT RECORD FOR ORGANIZER (if any) ===' as section;
SELECT 
    t.id,
    t.profile_id,
    t.full_name,
    t.business_name,
    t.organizer_code,
    t.accounting_status
FROM tenants t
WHERE t.profile_id = (SELECT id FROM profiles WHERE email = 'organizer@permit.com');

SELECT '=== TRIAL CALCULATION ===' as section;
WITH trial_calc AS (
    SELECT 
        p.id,
        p.email,
        p.created_at,
        14 as trial_period_days, -- from system_settings
        EXTRACT(DAY FROM (NOW() - p.created_at)) as days_since_created,
        14 - EXTRACT(DAY FROM (NOW() - p.created_at)) as days_remaining
    FROM profiles p
    WHERE p.email = 'organizer@permit.com'
)
SELECT 
    email,
    created_at,
    trial_period_days,
    days_since_created,
    days_remaining,
    CASE 
        WHEN days_remaining > 0 THEN 'TRIAL ACTIVE'
        ELSE 'TRIAL EXPIRED'
    END as trial_status
FROM trial_calc;
