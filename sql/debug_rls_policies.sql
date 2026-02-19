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
    tablename IN ('tenants', 'tenant_locations', 'locations', 'tenant_organizers', 'organizers')
ORDER BY
    tablename, policyname;
