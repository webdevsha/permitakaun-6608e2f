-- Fix script for tenant_id 44 to have proper Enterprise or SdnBhd plan
-- Run this in Supabase SQL Editor

-- First, check current state
SELECT 
    'BEFORE FIX' as status,
    t.id as tenant_id,
    t.accounting_status,
    t.full_name,
    s.plan_type,
    s.status as sub_status
FROM public.tenants t
LEFT JOIN public.subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
WHERE t.id = 44;

-- Option 1: Set tenant_id 44 to Enterprise (3 tabungs: operating, tax, zakat)
-- Uncomment to apply:
/*
-- Update tenant accounting status
UPDATE public.tenants 
SET accounting_status = 'active'
WHERE id = 44;

-- Deactivate any existing active subscriptions
UPDATE public.subscriptions
SET status = 'cancelled'
WHERE tenant_id = 44 AND status = 'active';

-- Create new Enterprise subscription (premium = Enterprise)
INSERT INTO public.subscriptions (tenant_id, plan_type, status, start_date, amount, created_at, updated_at)
VALUES (44, 'premium', 'active', CURRENT_DATE, 99.00, NOW(), NOW());
*/

-- Option 2: Set tenant_id 44 to SdnBhd (4 tabungs: operating, tax, zakat, investment)
-- Uncomment to apply:
/*
-- Update tenant accounting status
UPDATE public.tenants 
SET accounting_status = 'active'
WHERE id = 44;

-- Deactivate any existing active subscriptions
UPDATE public.subscriptions
SET status = 'cancelled'
WHERE tenant_id = 44 AND status = 'active';

-- Create new SdnBhd subscription (standard = SdnBhd)
INSERT INTO public.subscriptions (tenant_id, plan_type, status, start_date, amount, created_at, updated_at)
VALUES (44, 'standard', 'active', CURRENT_DATE, 79.00, NOW(), NOW());
*/

-- Option 3: Set tenant_id 44 to Full/Basic (7 tabungs: all)
-- Uncomment to apply:
/*
-- Update tenant accounting status
UPDATE public.tenants 
SET accounting_status = 'active'
WHERE id = 44;

-- Deactivate any existing active subscriptions
UPDATE public.subscriptions
SET status = 'cancelled'
WHERE tenant_id = 44 AND status = 'active';

-- Create new Basic subscription (basic = Full 7 tabungs)
INSERT INTO public.subscriptions (tenant_id, plan_type, status, start_date, amount, created_at, updated_at)
VALUES (44, 'basic', 'active', CURRENT_DATE, 49.00, NOW(), NOW());
*/

-- Verify after fix
SELECT 
    'AFTER FIX' as status,
    t.id as tenant_id,
    t.accounting_status,
    t.full_name,
    s.plan_type,
    s.status as sub_status
FROM public.tenants t
LEFT JOIN public.subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
WHERE t.id = 44;
