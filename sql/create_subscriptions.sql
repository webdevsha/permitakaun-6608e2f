-- Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id bigint REFERENCES tenants(id) ON DELETE CASCADE,
    plan_type text NOT NULL CHECK (plan_type IN ('basic', 'standard', 'premium')),
    status text NOT NULL CHECK (status IN ('active', 'expired', 'payment_pending')),
    start_date timestamptz DEFAULT now(),
    end_date timestamptz,
    amount numeric,
    payment_ref text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenants can view own subscription" 
ON subscriptions FOR SELECT 
USING (tenant_id IN (
    SELECT id FROM tenants WHERE profile_id = auth.uid()
));

-- Allow anyone (server action) to insert/update? 
-- Usually server actions use Service Role, but if using RLS, we need policy.
-- For now, relying on Service Role for critical updates (activation).
