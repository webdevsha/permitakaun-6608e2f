-- Delete all seed data for Hazman (admin@kumim.my / ORG002)
-- Keep seed data for Admin (admin@permit.com) and demo organizer (ORG001)

-- First, get the organizer ID for ORG002
DO $$
DECLARE
    org002_id UUID;
BEGIN
    -- Get ORG002 organizer ID
    SELECT id INTO org002_id FROM public.organizers WHERE organizer_code = 'ORG002';
    
    IF org002_id IS NOT NULL THEN
        -- Delete transactions for ORG002 tenants
        DELETE FROM public.transactions 
        WHERE tenant_id IN (
            SELECT id FROM public.tenants WHERE organizer_code = 'ORG002'
        );
        
        -- Delete tenant_locations for ORG002 tenants
        DELETE FROM public.tenant_locations 
        WHERE tenant_id IN (
            SELECT id FROM public.tenants WHERE organizer_code = 'ORG002'
        );
        
        -- Delete tenant_locations for ORG002 locations
        DELETE FROM public.tenant_locations 
        WHERE location_id IN (
            SELECT id FROM public.locations WHERE organizer_id = org002_id
        );
        
        -- Delete tenants linked to ORG002
        DELETE FROM public.tenants WHERE organizer_code = 'ORG002';
        
        -- Delete locations owned by ORG002
        DELETE FROM public.locations WHERE organizer_id = org002_id;
        
        RAISE NOTICE 'Successfully deleted all seed data for ORG002 (Hazman/admin@kumim.my)';
    ELSE
        RAISE NOTICE 'ORG002 organizer not found - no data to delete';
    END IF;
END $$;

-- Verify what's left
SELECT 'Remaining Organizers:' as info;
SELECT organizer_code, name, email FROM public.organizers ORDER BY organizer_code;

SELECT 'Remaining Locations:' as info;
SELECT l.name, o.organizer_code, o.name as organizer_name 
FROM public.locations l 
LEFT JOIN public.organizers o ON l.organizer_id = o.id
ORDER BY o.organizer_code;

SELECT 'Remaining Tenants:' as info;
SELECT full_name, business_name, organizer_code 
FROM public.tenants 
ORDER BY organizer_code;
