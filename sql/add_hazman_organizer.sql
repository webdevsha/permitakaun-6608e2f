-- Add Hazman (admin@kumim.my) to Organizers table
-- Ensure he appears in Penganjur list

DO $$
DECLARE
    p_id uuid;
    p_name text;
BEGIN
    -- 1. Get Profile ID
    SELECT id, full_name INTO p_id, p_name 
    FROM public.profiles 
    WHERE email = 'admin@kumim.my';

    IF p_id IS NULL THEN
        RAISE EXCEPTION 'User admin@kumim.my not found in profiles table.';
    END IF;

    -- 2. Insert into Organizers
    -- Use ON CONFLICT to avoid errors if he's already there (maybe inactive?)
    INSERT INTO public.organizers (id, name, email, organizer_code, status, accounting_status)
    VALUES (
        p_id,
        COALESCE(p_name, 'Hazman (KumiM)'),
        'admin@kumim.my',
        'ORG_KUMIM', -- Assigning a code
        'active',
        'active'
    )
    ON CONFLICT (id) DO UPDATE
    SET status = 'active',
        accounting_status = 'active';

    RAISE NOTICE 'Hazman added to Organizers successfully.';
END $$;
