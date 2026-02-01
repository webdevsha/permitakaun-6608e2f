-- Add accounting_status column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS accounting_status TEXT DEFAULT 'inactive';

-- Update existing tenants to have 'active' accounting if they are already 'active' (Optional, or default to inactive)
-- User instruction implies separate control. Let's default to 'inactive' to be safe, or 'active' for convenience?
-- "Status Akaun ... is to activate general account, not for accounting".
-- So new tenants might need manual activation. Default 'inactive' is safer.
-- But for existing active tenants, maybe they expect it?
-- Let's stick to default 'inactive' for now.

-- Enable RLS for this column if needed (usually redundant if table has RLS)
