-- Deep Debug of Data Relationships
DO $$
DECLARE
    org_email text := 'organizer@permit.com';
    org_uid uuid;
    org_id bigint; -- internal ID from organizers table if any
    
    loc_count int;
    tenant_rental_count int;
    tx_count int;
BEGIN
    -- 1. Get Organizer UID
    SELECT id INTO org_uid FROM profiles WHERE email = org_email;
    RAISE NOTICE 'Organizer UID: %', org_uid;

    -- 2. Check Locations owned by this UID
    SELECT count(*) INTO loc_count FROM locations WHERE organizer_id = org_uid;
    RAISE NOTICE 'Locations owned by UID: %', loc_count;

    -- List Locations
    FOR org_id IN SELECT id FROM locations WHERE organizer_id = org_uid LOOP
        RAISE NOTICE ' -> Owns Location ID: %', org_id;
    END LOOP;

    -- 3. Check Tenant Rentals at these locations
    -- Join tenant_locations -> locations
    SELECT count(*) INTO tenant_rental_count
    FROM tenant_locations tl
    JOIN locations l ON tl.location_id = l.id
    WHERE l.organizer_id = org_uid;
    
    RAISE NOTICE 'Tenants renting these locations: %', tenant_rental_count;
    
    -- List Tenants
    FOR org_id IN 
        SELECT tl.tenant_id 
        FROM tenant_locations tl 
        JOIN locations l ON tl.location_id = l.id 
        WHERE l.organizer_id = org_uid 
    LOOP
        RAISE NOTICE ' -> Tenant ID Renting: %', org_id;
        
        -- 4. Check Transactions for this Tenant
        SELECT count(*) INTO tx_count FROM transactions WHERE tenant_id = org_id;
        RAISE NOTICE '    -> Has % Transactions', tx_count;
    END LOOP;

END $$;
