SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM
    pg_policies
WHERE
    tablename IN ('tenants', 'tenant_locations', 'locations', 'tenant_organizers', 'organizers', 'organizer_transactions', 'admin_transactions', 'tenant_transactions')
ORDER BY
    tablename, policyname;
