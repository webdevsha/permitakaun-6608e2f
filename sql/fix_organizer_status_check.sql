ALTER TABLE public.organizers DROP CONSTRAINT IF EXISTS organizers_status_check;
ALTER TABLE public.organizers ADD CONSTRAINT organizers_status_check CHECK (status in ('active', 'inactive', 'pending'));
