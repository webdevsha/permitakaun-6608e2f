-- Quick fix: Ensure organizer@permit.com has Akaun access
-- Run this to immediately fix the issue

-- Option 1: Set accounting_status to active (immediate access)
UPDATE organizers 
SET accounting_status = 'active'
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'organizer@permit.com');

-- Option 2: Reset trial start date to today (gives 14 days)
-- UPDATE profiles 
-- SET created_at = NOW()
-- WHERE email = 'organizer@permit.com';

-- Verify the fix
SELECT 
    p.email,
    p.created_at,
    o.accounting_status,
    o.name,
    CASE 
        WHEN o.accounting_status = 'active' THEN '✅ ACCESS GRANTED (Active Status)'
        WHEN 14 - EXTRACT(DAY FROM (NOW() - p.created_at)) > 0 
            THEN '✅ ACCESS GRANTED (Trial: ' || (14 - EXTRACT(DAY FROM (NOW() - p.created_at))) || ' days left)'
        ELSE '❌ ACCESS DENIED (Trial Expired)'
    END as akaun_access
FROM profiles p
LEFT JOIN organizers o ON o.profile_id = p.id
WHERE p.email = 'organizer@permit.com';
