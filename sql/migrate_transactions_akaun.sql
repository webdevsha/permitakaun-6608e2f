-- ============================================================================
-- MIGRATION: Separate Akaun Transactions for Admin, Organizer, and Tenant
-- ============================================================================
-- This migration creates three separate transaction tables to avoid confusion:
-- 1. admin_transactions    - For platform admin financial records
-- 2. organizer_transactions - For organizer's Akaun (income from tenants)
-- 3. tenant_transactions   - For tenant's Akaun (expenses/payments)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Admin Transactions Table (from existing transactions)
-- ============================================================================

-- Create new admin_transactions table
CREATE TABLE IF NOT EXISTS public.admin_transactions (
    id SERIAL PRIMARY KEY,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    reference_id INTEGER, -- Can reference organizer_id or tenant_id depending on context
    reference_type VARCHAR(20), -- 'organizer', 'tenant', 'platform'
    is_sandbox BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for admin_transactions
CREATE INDEX IF NOT EXISTS idx_admin_transactions_admin_id ON public.admin_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_profile_id ON public.admin_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_date ON public.admin_transactions(date);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_status ON public.admin_transactions(status);
CREATE INDEX IF NOT EXISTS idx_admin_transactions_type ON public.admin_transactions(type);

-- Enable RLS for admin_transactions
ALTER TABLE public.admin_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view admin transactions
DROP POLICY IF EXISTS "Admins view own transactions" ON public.admin_transactions;
CREATE POLICY "Admins view own transactions" ON public.admin_transactions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
);

COMMENT ON TABLE public.admin_transactions IS 'Financial transactions for platform administrators';

-- ============================================================================
-- STEP 2: Create Organizer Transactions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizer_transactions (
    id SERIAL PRIMARY KEY,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES public.tenants(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    payment_reference VARCHAR(100), -- Reference to tenant_payments or billplz
    is_auto_generated BOOLEAN DEFAULT false, -- True if from payment approval
    is_sandbox BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- Flexible field for additional data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for organizer_transactions
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_organizer_id ON public.organizer_transactions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_tenant_id ON public.organizer_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_location_id ON public.organizer_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_date ON public.organizer_transactions(date);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_status ON public.organizer_transactions(status);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_type ON public.organizer_transactions(type);
CREATE INDEX IF NOT EXISTS idx_organizer_transactions_payment_ref ON public.organizer_transactions(payment_reference);

-- Enable RLS for organizer_transactions
ALTER TABLE public.organizer_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organizers can only see their own transactions
DROP POLICY IF EXISTS "Organizers view own transactions" ON public.organizer_transactions;
CREATE POLICY "Organizers view own transactions" ON public.organizer_transactions
FOR ALL TO authenticated
USING (
    -- Organizer owns the transaction
    organizer_id = auth.uid()
    OR
    -- Staff of the organizer can see transactions
    EXISTS (
        SELECT 1 FROM public.staff s
        JOIN public.organizers o ON o.id = s.admin_id
        WHERE s.profile_id = auth.uid()
        AND o.id = organizer_transactions.organizer_id
    )
);

COMMENT ON TABLE public.organizer_transactions IS 'Financial transactions for organizers (income from tenant rentals)';

-- ============================================================================
-- STEP 3: Create Tenant Transactions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_transactions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Link to user account if exists
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    category VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    payment_reference VARCHAR(100), -- Reference to tenant_payments or billplz
    is_rent_payment BOOLEAN DEFAULT false, -- True if this is a rental payment
    is_sandbox BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}', -- Flexible field for additional data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for tenant_transactions
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_tenant_id ON public.tenant_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_profile_id ON public.tenant_transactions(profile_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_organizer_id ON public.tenant_transactions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_location_id ON public.tenant_transactions(location_id);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_date ON public.tenant_transactions(date);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_status ON public.tenant_transactions(status);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_type ON public.tenant_transactions(type);
CREATE INDEX IF NOT EXISTS idx_tenant_transactions_payment_ref ON public.tenant_transactions(payment_reference);

-- Enable RLS for tenant_transactions
ALTER TABLE public.tenant_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenants can only see their own transactions
DROP POLICY IF EXISTS "Tenants view own transactions" ON public.tenant_transactions;
CREATE POLICY "Tenants view own transactions" ON public.tenant_transactions
FOR ALL TO authenticated
USING (
    -- Tenant profile matches
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = tenant_transactions.tenant_id
        AND t.profile_id = auth.uid()
    )
    OR
    -- Organizer of the tenant can see (for verification)
    EXISTS (
        SELECT 1 FROM public.organizers o
        JOIN public.tenants t ON t.organizer_code = o.organizer_code
        WHERE t.id = tenant_transactions.tenant_id
        AND o.id = auth.uid()
    )
);

COMMENT ON TABLE public.tenant_transactions IS 'Financial transactions for tenants (expenses/payments to organizers)';

-- ============================================================================
-- STEP 4: Migrate Data from Existing transactions Table
-- ============================================================================

-- First, let's see what data we have
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.transactions;
    RAISE NOTICE 'Found % existing transactions to migrate', v_count;
END $$;

-- Migrate existing transactions to tenant_transactions (since current transactions are tenant-focused)
-- The current transactions table links to tenant_id and tracks rent payments
INSERT INTO public.tenant_transactions (
    tenant_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    is_rent_payment,
    is_sandbox,
    created_at,
    organizer_id,
    location_id
)
SELECT 
    t.tenant_id,
    t.amount,
    t.type, -- Keep original type (expense for tenants)
    t.category,
    t.status,
    t.date,
    t.description,
    t.receipt_url,
    CASE 
        WHEN t.category = 'Sewa' OR t.description ILIKE '%sewa%' OR t.description ILIKE '%rent%' 
        THEN true 
        ELSE false 
    END as is_rent_payment,
    COALESCE(t.is_sandbox, false),
    t.created_at,
    -- Try to find organizer_id from tenant
    (SELECT o.id FROM public.tenants tn
     JOIN public.organizers o ON o.organizer_code = tn.organizer_code
     WHERE tn.id = t.tenant_id
     LIMIT 1),
    -- Try to find location_id from tenant_locations
    (SELECT tl.location_id FROM public.tenant_locations tl
     WHERE tl.tenant_id = t.tenant_id
     ORDER BY tl.created_at DESC
     LIMIT 1)
FROM public.transactions t
WHERE t.tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Also create corresponding organizer transactions (income for organizers)
INSERT INTO public.organizer_transactions (
    organizer_id,
    tenant_id,
    location_id,
    amount,
    type,
    category,
    status,
    date,
    description,
    receipt_url,
    is_auto_generated,
    is_sandbox,
    created_at,
    payment_reference
)
SELECT 
    o.id as organizer_id,
    t.tenant_id,
    (SELECT tl.location_id FROM public.tenant_locations tl
     WHERE tl.tenant_id = t.tenant_id
     ORDER BY tl.created_at DESC
     LIMIT 1),
    t.amount,
    'income' as type, -- Organizer sees this as income
    t.category,
    t.status,
    t.date,
    'Bayaran dari: ' || COALESCE(tn.business_name, tn.full_name, 'Penyewa') || ' - ' || t.description as description,
    t.receipt_url,
    true as is_auto_generated,
    COALESCE(t.is_sandbox, false),
    t.created_at,
    -- Extract billplz reference if exists
    CASE 
        WHEN t.receipt_url LIKE '%billplz%'
        THEN substring(t.receipt_url from 'bills/([a-zA-Z0-9]+)')
        ELSE NULL
    END
FROM public.transactions t
JOIN public.tenants tn ON tn.id = t.tenant_id
JOIN public.organizers o ON o.organizer_code = tn.organizer_code
WHERE t.tenant_id IS NOT NULL
AND t.status = 'approved'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: Rename Original transactions Table
-- ============================================================================

-- Rename the original table to admin_transactions_backup
-- We keep it as backup, admin can access via admin_transactions going forward
ALTER TABLE IF EXISTS public.transactions RENAME TO transactions_backup;

-- Create a view for backward compatibility during transition (optional)
-- This allows old code to still work while transitioning
CREATE OR REPLACE VIEW public.transactions AS
    SELECT 
        id,
        tenant_id,
        amount,
        type,
        category,
        status,
        date,
        description,
        receipt_url,
        created_at,
        NULL::boolean as is_sandbox
    FROM public.transactions_backup;

COMMENT ON VIEW public.transactions IS 'Backward compatibility view - Migrate to tenant_transactions or organizer_transactions';

-- ============================================================================
-- STEP 6: Update Triggers for Auto-Transaction Creation
-- ============================================================================

-- Update the payment approval trigger to create entries in both tables
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
    v_location_id INTEGER;
    v_tenant_name TEXT;
BEGIN
    -- Get organizer info
    SELECT 
        o.id,
        COALESCE(t.business_name, t.full_name)
    INTO 
        v_organizer_id,
        v_tenant_name
    FROM public.tenants t
    JOIN public.organizers o ON o.organizer_code = t.organizer_code
    WHERE t.id = NEW.tenant_id;

    -- Get location info
    SELECT tl.location_id INTO v_location_id
    FROM public.tenant_locations tl
    WHERE tl.tenant_id = NEW.tenant_id
    ORDER BY tl.created_at DESC
    LIMIT 1;

    -- Check if status changed to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Create tenant transaction (expense for tenant)
        INSERT INTO public.tenant_transactions (
            tenant_id,
            organizer_id,
            location_id,
            amount,
            type,
            category,
            status,
            date,
            description,
            receipt_url,
            is_rent_payment,
            is_sandbox,
            payment_reference
        ) VALUES (
            NEW.tenant_id,
            v_organizer_id,
            v_location_id,
            NEW.amount,
            'expense',
            'Sewa',
            'approved',
            COALESCE(NEW.payment_date, CURRENT_DATE),
            'Bayaran Sewa/Permit (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            NEW.is_sandbox,
            NEW.billplz_id
        );

        -- Create organizer transaction (income for organizer)
        INSERT INTO public.organizer_transactions (
            organizer_id,
            tenant_id,
            location_id,
            amount,
            type,
            category,
            status,
            date,
            description,
            receipt_url,
            is_auto_generated,
            is_sandbox,
            payment_reference
        ) VALUES (
            v_organizer_id,
            NEW.tenant_id,
            v_location_id,
            NEW.amount,
            'income',
            'Sewa',
            'approved',
            COALESCE(NEW.payment_date, CURRENT_DATE),
            'Bayaran dari: ' || COALESCE(v_tenant_name, 'Penyewa') || ' (Ref: ' || COALESCE(NEW.billplz_id, 'Manual') || ')',
            NEW.receipt_url,
            true,
            NEW.is_sandbox,
            NEW.billplz_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Create Helper Functions
-- ============================================================================

-- Function to get tenant Akaun summary
CREATE OR REPLACE FUNCTION public.get_tenant_akaun_summary(p_tenant_id INTEGER)
RETURNS TABLE (
    total_income DECIMAL(10,2),
    total_expense DECIMAL(10,2),
    balance DECIMAL(10,2),
    pending_payments DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'approved' THEN amount ELSE -amount END), 0) as balance,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_payments
    FROM public.tenant_transactions
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get organizer Akaun summary
CREATE OR REPLACE FUNCTION public.get_organizer_akaun_summary(p_organizer_id UUID)
RETURNS TABLE (
    total_income DECIMAL(10,2),
    total_expense DECIMAL(10,2),
    balance DECIMAL(10,2),
    pending_income DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'approved' THEN amount ELSE -amount END), 0) as balance,
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount ELSE 0 END), 0) as pending_income
    FROM public.organizer_transactions
    WHERE organizer_id = p_organizer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Grant Permissions
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizer_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_transactions TO authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE public.admin_transactions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.organizer_transactions_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tenant_transactions_id_seq TO authenticated;

-- Grant permissions to anon (for public access if needed)
GRANT SELECT ON public.admin_transactions TO anon;
GRANT SELECT ON public.organizer_transactions TO anon;
GRANT SELECT ON public.tenant_transactions TO anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show summary of migrated data
SELECT 
    'Tenant Transactions' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT tenant_id) as unique_tenants
FROM public.tenant_transactions
UNION ALL
SELECT 
    'Organizer Transactions' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT organizer_id) as unique_organizers
FROM public.organizer_transactions
UNION ALL
SELECT 
    'Backup Transactions' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT tenant_id) as unique_tenants
FROM public.transactions_backup;
