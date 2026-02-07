-- ============================================================================
-- FIX: Add missing columns to admin_transactions table
-- This fixes the issue where subscription payments weren't being recorded
-- ============================================================================

-- Add missing columns for payment tracking to admin_transactions
ALTER TABLE public.admin_transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Also add missing columns to organizer_transactions
ALTER TABLE public.organizer_transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Also add missing columns to tenant_transactions  
ALTER TABLE public.tenant_transactions 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_admin_transactions_payment_ref ON public.admin_transactions(payment_reference);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_category ON public.admin_transactions(category);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_metadata ON public.admin_transactions USING GIN(metadata);

-- Update RLS policies to allow service role to insert
-- (Service role bypasses RLS anyway, but this ensures consistency)

-- Policy for admins to view all admin transactions
DROP POLICY IF EXISTS "Admins view admin transactions" ON public.admin_transactions;
CREATE POLICY "Admins view admin transactions" ON public.admin_transactions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.role = 'superadmin')
    )
);

-- Policy for admins to insert admin transactions
DROP POLICY IF EXISTS "Admins insert admin transactions" ON public.admin_transactions;
CREATE POLICY "Admins insert admin transactions" ON public.admin_transactions
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.role = 'superadmin')
    )
);

-- Policy for admins to update admin transactions
DROP POLICY IF EXISTS "Admins update admin transactions" ON public.admin_transactions;
CREATE POLICY "Admins update admin transactions" ON public.admin_transactions
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.role = 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.role = 'superadmin')
    )
);

-- ============================================================================
-- MIGRATE: Move existing subscription data from wrong tables if any
-- ============================================================================

-- Check if there are any subscription records in organizer_transactions that should be in admin_transactions
-- (This fixes any data that was incorrectly stored)

INSERT INTO public.admin_transactions (
    description,
    amount,
    type,
    category,
    status,
    date,
    payment_method,
    payment_reference,
    receipt_url,
    metadata,
    is_sandbox,
    created_at
)
SELECT 
    ot.description,
    ot.amount,
    'income' as type,  -- These are income for admin
    'Langganan' as category,
    ot.status,
    ot.date,
    ot.payment_method,
    ot.payment_reference,
    ot.receipt_url,
    COALESCE(ot.metadata, '{}'::jsonb) || jsonb_build_object(
        'migrated_from', 'organizer_transactions',
        'migrated_at', NOW()
    ),
    ot.is_sandbox,
    ot.created_at
FROM public.organizer_transactions ot
WHERE ot.description ILIKE '%Langganan%'
  OR ot.description ILIKE '%Subscription%'
  OR (ot.metadata->>'is_subscription')::boolean = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFY: Check the structure
-- ============================================================================

-- Show current columns
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'admin_transactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show count of records
SELECT 
    'admin_transactions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE category = 'Langganan') as subscription_records,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_records,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_records
FROM public.admin_transactions;
