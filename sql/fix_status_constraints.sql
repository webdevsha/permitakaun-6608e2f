DO $$ 
DECLARE
    row record;
BEGIN
    -- Drop all check constraints on organizers.status
    FOR row IN 
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.organizers'::regclass
        AND c.contype = 'c'
        AND a.attname = 'status'
    LOOP
        EXECUTE 'ALTER TABLE public.organizers DROP CONSTRAINT ' || quote_ident(row.conname);
    END LOOP;

    -- Drop all check constraints on tenants.status
    FOR row IN 
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.tenants'::regclass
        AND c.contype = 'c'
        AND a.attname = 'status'
    LOOP
        EXECUTE 'ALTER TABLE public.tenants DROP CONSTRAINT ' || quote_ident(row.conname);
    END LOOP;
END $$;

-- Add new constraints allowing 'pending'
ALTER TABLE public.organizers ADD CONSTRAINT organizers_status_check CHECK (status in ('active', 'inactive', 'pending'));
ALTER TABLE public.tenants ADD CONSTRAINT tenants_status_check CHECK (status in ('active', 'inactive', 'pending'));
