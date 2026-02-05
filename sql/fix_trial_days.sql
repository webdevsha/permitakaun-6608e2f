-- Fix the trial_duration_days in accounting_module settings

-- Update accounting_module to use 14 days (consistent with trial_period_days)
UPDATE system_settings 
SET value = '{"is_active":true,"trial_duration_days":14}'
WHERE key = 'accounting_module';

-- Verify the fix
SELECT key, value FROM system_settings WHERE key IN ('accounting_module', 'trial_period_days');

-- Recalculate trial status for organizer@permit.com
SELECT 
    p.email,
    p.created_at,
    14 as trial_days,
    EXTRACT(DAY FROM (NOW() - p.created_at)) as days_since_created,
    14 - EXTRACT(DAY FROM (NOW() - p.created_at)) as days_remaining,
    CASE 
        WHEN 14 - EXTRACT(DAY FROM (NOW() - p.created_at)) > 0 THEN '✅ TRIAL ACTIVE'
        ELSE '❌ TRIAL EXPIRED'
    END as status
FROM profiles p
WHERE p.email = 'organizer@permit.com';
