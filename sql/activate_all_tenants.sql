-- ============================================================================
-- ACTIVATE: Set all pending tenants to active
-- ============================================================================

-- 1. Check current tenant status distribution
SELECT 
    status,
    COUNT(*) as count
FROM tenants
GROUP BY status;

-- 2. Activate all pending tenants
UPDATE tenants
SET status = 'active'
WHERE status = 'pending';

-- 3. Activate all tenant_organizers links
UPDATE tenant_organizers
SET status = 'active'
WHERE status = 'pending';

-- 4. Activate all tenant_locations
UPDATE tenant_locations
SET status = 'active', is_active = true
WHERE status = 'pending';

-- 5. Verify
SELECT 'Tenants activated' as check_type, COUNT(*) as count FROM tenants WHERE status = 'active'
UNION ALL
SELECT 'Tenant_organizers active', COUNT(*) FROM tenant_organizers WHERE status = 'active'
UNION ALL
SELECT 'Tenant_locations active', COUNT(*) FROM tenant_locations WHERE status = 'active';

SELECT 'All tenants activated successfully' as status;
