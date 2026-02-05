-- Add trial tracking fields to profiles table if not exists

-- Check if profiles table has all necessary fields
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- The created_at field in profiles already tracks trial start
-- Verify organizer accounting_status
SELECT 
    o.organizer_code,
    o.name,
    o.accounting_status,
    p.created_at,
    p.email
FROM organizers o
JOIN profiles p ON p.id = o.profile_id
WHERE o.profile_id IN (SELECT id FROM profiles WHERE role = 'organizer');

-- Update organizer@permit.com to have accounting active (for testing)
-- UPDATE organizers 
-- SET accounting_status = 'active'
-- WHERE profile_id = (SELECT id FROM profiles WHERE email = 'organizer@permit.com');

-- Verify the update
SELECT 
    'ORGANIZER ACCESS CHECK' as check_type,
    p.email,
    p.created_at,
    o.accounting_status,
    EXTRACT(DAY FROM (NOW() - p.created_at)) as days_since_created,
    14 - EXTRACT(DAY FROM (NOW() - p.created_at)) as days_remaining,
    CASE 
        WHEN o.accounting_status = 'active' THEN 'ACCESS VIA ACTIVE STATUS'
        WHEN 14 - EXTRACT(DAY FROM (NOW() - p.created_at)) > 0 THEN 'ACCESS VIA TRIAL'
        ELSE 'NO ACCESS'
    END as access_method
FROM profiles p
JOIN organizers o ON o.profile_id = p.id
WHERE p.email = 'organizer@permit.com';
