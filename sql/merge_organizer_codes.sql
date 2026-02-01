-- Merge ORG001_OLD_550 data into ORG001
-- This fixes the issue where tenants/payments are 'hidden' under the old renamed code.

DO $$
BEGIN
    -- 1. Update Tenants
    UPDATE public.tenants
    SET organizer_code = 'ORG001'
    WHERE organizer_code LIKE 'ORG001_OLD_%';
    
    RAISE NOTICE 'Updated Tenants to ORG001.';

    -- 2. Update Tenant Payments
    UPDATE public.tenant_payments
    SET organizer_code = 'ORG001'
    WHERE organizer_code LIKE 'ORG001_OLD_%';

    RAISE NOTICE 'Updated Tenant Payments to ORG001.';
    
END $$;
