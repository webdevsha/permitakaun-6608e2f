-- Backfill: set all tenant_locations with status='approved' to 'active'
-- and auto-determine rate_type from the location's type field.
-- Run once in Supabase SQL editor.

UPDATE public.tenant_locations tl
SET
  status = 'active',
  rate_type = CASE
    WHEN l.type = 'cbs'                                         THEN 'cbs'
    WHEN l.type IN ('daily', 'khemah', 'bazar_ramadhan', 'expo')
      THEN CASE
        WHEN COALESCE(l.rate_khemah, 0) > 0 OR COALESCE(l.rate_monthly_khemah, 0) > 0 THEN 'khemah'
        WHEN COALESCE(l.rate_cbs, 0) > 0    OR COALESCE(l.rate_monthly_cbs, 0) > 0    THEN 'cbs'
        ELSE 'monthly'
      END
    ELSE 'monthly'
  END
FROM public.locations l
WHERE tl.location_id = l.id
  AND tl.status = 'approved';

-- Verify
SELECT status, rate_type, COUNT(*)
FROM public.tenant_locations
GROUP BY status, rate_type
ORDER BY status, rate_type;
