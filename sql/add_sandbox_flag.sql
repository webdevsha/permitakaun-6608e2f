-- Add is_sandbox column to identify Test Data

-- 1. tenant_payments
ALTER TABLE public.tenant_payments
ADD COLUMN IF NOT EXISTS is_sandbox boolean DEFAULT false;

-- 2. transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_sandbox boolean DEFAULT false;

-- Optional: Update existing 'pending' transactions from recent tests to true if they look like sandbox?
-- For now, default false.
