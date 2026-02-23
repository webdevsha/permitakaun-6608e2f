-- Auto-approve all pending tenant payments and backfill organizer transactions
-- Run this once to ensure all existing payments are visible to organizers

-- ============================================================
-- STEP 0: Add missing columns to tenant_payments if not exist
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_payments'
        AND column_name = 'organizer_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tenant_payments
        ADD COLUMN organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added organizer_id column to tenant_payments';
    ELSE
        RAISE NOTICE 'organizer_id already exists in tenant_payments';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_payments'
        AND column_name = 'remarks'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tenant_payments ADD COLUMN remarks TEXT;
        RAISE NOTICE 'Added remarks column to tenant_payments';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_payments_organizer_id ON public.tenant_payments(organizer_id);

-- ============================================================
-- STEP 1: Fix missing organizer_id in tenant_payments
-- ============================================================

-- 1a. From locations table via location_id
UPDATE public.tenant_payments tp
SET organizer_id = l.organizer_id
FROM public.locations l
WHERE tp.location_id = l.id
AND tp.organizer_id IS NULL
AND l.organizer_id IS NOT NULL;

-- 1b. Fallback: from tenant's primary organizer_code
UPDATE public.tenant_payments tp
SET organizer_id = o.id
FROM public.organizers o
JOIN public.tenants t ON t.organizer_code = o.organizer_code
WHERE tp.tenant_id = t.id
AND tp.organizer_id IS NULL
AND t.organizer_code IS NOT NULL;

-- 1c. Fallback: from most recent active tenant_location
UPDATE public.tenant_payments tp
SET organizer_id = sub.organizer_id
FROM (
    SELECT DISTINCT ON (tl.tenant_id)
        tl.tenant_id,
        COALESCE(tl.organizer_id, l.organizer_id) AS organizer_id
    FROM public.tenant_locations tl
    JOIN public.locations l ON l.id = tl.location_id
    WHERE tl.is_active = true
    ORDER BY tl.tenant_id, tl.created_at DESC
) sub
WHERE tp.tenant_id = sub.tenant_id
AND tp.organizer_id IS NULL
AND sub.organizer_id IS NOT NULL;

-- ============================================================
-- STEP 2: Auto-approve all pending tenant_payments
-- (fires on_payment_approved trigger -> creates tenant_transactions
--  and organizer_transactions automatically)
-- ============================================================

UPDATE public.tenant_payments
SET status = 'approved'
WHERE status = 'pending'
AND organizer_id IS NOT NULL;

-- ============================================================
-- STEP 3: Backfill missing organizer_transactions
-- ============================================================

INSERT INTO public.organizer_transactions (
    organizer_id, tenant_id, location_id, amount, type, category,
    status, date, description, receipt_url, is_auto_generated, is_sandbox, payment_reference
)
SELECT
    tp.organizer_id, tp.tenant_id, tp.location_id, tp.amount,
    'income', 'Sewa', 'approved',
    COALESCE(tp.payment_date::date, CURRENT_DATE),
    'Bayaran Sewa dari: ' || COALESCE(t.business_name, t.full_name, 'Penyewa') ||
        ' (Kepada: ' || COALESCE(o.name, 'Organizer') || ')' ||
        CASE WHEN tp.billplz_id IS NOT NULL THEN ' (Ref: ' || tp.billplz_id || ')' ELSE ' (Manual)' END,
    tp.receipt_url, true, COALESCE(tp.is_sandbox, false), tp.billplz_id
FROM public.tenant_payments tp
JOIN public.tenants t ON t.id = tp.tenant_id
LEFT JOIN public.organizers o ON o.id = tp.organizer_id
WHERE tp.status = 'approved'
AND tp.organizer_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.organizer_transactions ot
    WHERE ot.tenant_id = tp.tenant_id
    AND ot.organizer_id = tp.organizer_id
    AND ot.category = 'Sewa'
    AND (
        (tp.billplz_id IS NOT NULL AND ot.payment_reference = tp.billplz_id)
        OR
        (tp.billplz_id IS NULL
         AND ot.amount = tp.amount
         AND ot.date = COALESCE(tp.payment_date::date, CURRENT_DATE)
         AND ot.is_auto_generated = true)
    )
);

-- ============================================================
-- STEP 4: Backfill missing tenant_transactions (expense side)
-- ============================================================

INSERT INTO public.tenant_transactions (
    tenant_id, profile_id, organizer_id, location_id, amount, type, category,
    status, date, description, receipt_url, is_rent_payment, is_sandbox, payment_reference
)
SELECT
    tp.tenant_id, t.profile_id, tp.organizer_id, tp.location_id, tp.amount,
    'expense', 'Sewa', 'approved',
    COALESCE(tp.payment_date::date, CURRENT_DATE),
    'Bayaran Sewa/Permit' ||
        CASE WHEN tp.billplz_id IS NOT NULL THEN ' (Ref: ' || tp.billplz_id || ')' ELSE ' (Manual)' END,
    tp.receipt_url, true, COALESCE(tp.is_sandbox, false), tp.billplz_id
FROM public.tenant_payments tp
JOIN public.tenants t ON t.id = tp.tenant_id
WHERE tp.status = 'approved'
AND NOT EXISTS (
    SELECT 1 FROM public.tenant_transactions tt
    WHERE tt.tenant_id = tp.tenant_id
    AND tt.is_rent_payment = true
    AND tt.category IN ('Sewa', 'Bayaran Sewa')
    AND (
        (tp.billplz_id IS NOT NULL AND tt.payment_reference = tp.billplz_id)
        OR
        (tp.billplz_id IS NULL
         AND tt.amount = tp.amount
         AND tt.date = COALESCE(tp.payment_date::date, CURRENT_DATE))
    )
);

-- ============================================================
-- STEP 5: Fix organizer_id in existing tenant_transactions
-- ============================================================

UPDATE public.tenant_transactions tt
SET organizer_id = l.organizer_id
FROM public.locations l
WHERE tt.location_id = l.id
AND tt.organizer_id IS NULL
AND tt.category IN ('Sewa', 'Bayaran Sewa', 'Rent', 'Rental')
AND l.organizer_id IS NOT NULL;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT status, COUNT(*) AS count, SUM(amount) AS total
FROM public.tenant_payments GROUP BY status ORDER BY status;

SELECT o.name AS organizer, COUNT(ot.id) AS sewa_txns, SUM(ot.amount) AS total_income
FROM public.organizer_transactions ot
JOIN public.organizers o ON o.id = ot.organizer_id
WHERE ot.category = 'Sewa' AND ot.status = 'approved'
GROUP BY o.name ORDER BY total_income DESC;
