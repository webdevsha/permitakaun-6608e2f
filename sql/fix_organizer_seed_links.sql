-- FIX ORGANIZER SEED LINKS (ROBUST VERSION)
-- Handles duplicate ORG001 codes by renaming collisions first.

DO $$
DECLARE
    target_profile_id uuid;
BEGIN
    -- 1. Get Profile ID for organizer@permit.com (The intended owner of ORG001)
    SELECT id INTO target_profile_id FROM public.profiles WHERE email = 'organizer@permit.com';

    IF target_profile_id IS NOT NULL THEN
    
        -- 2. Resolve Conflict: If anyone else has ORG001, rename it.
        UPDATE public.organizers
        SET organizer_code = 'ORG001_OLD_' || floor(random() * 1000)::text
        WHERE organizer_code = 'ORG001' AND id != target_profile_id;
        
        -- 3. Upsert into Organizers table
        INSERT INTO public.organizers (id, name, email, organizer_code, status)
        VALUES (
            target_profile_id,
            'Majlis Perbandaran Kuala Langat (Demo)',
            'organizer@permit.com',
            'ORG001',
            'active'
        )
        ON CONFLICT (id) DO UPDATE
        SET organizer_code = 'ORG001', -- Force correct code
            status = 'active';

        -- 4. Link Seed Locations
        UPDATE public.locations
        SET organizer_id = target_profile_id
        WHERE name IN ('Pasar Malam Seksyen 7', 'Uptown Rimbayu', 'Pasar Tani Stadium');
        
        -- 5. Link Tenants
        UPDATE public.tenants
        SET organizer_code = 'ORG001'
        WHERE email IN ('ahmad@permit.com', 'siti@permit.com', 'faizal@permit.com');

        RAISE NOTICE 'Links fixed. ORG001 assigned to organizer@permit.com';
    ELSE
        RAISE NOTICE 'organizer@permit.com profile not found. Skipping.';
    END IF;
END $$;
