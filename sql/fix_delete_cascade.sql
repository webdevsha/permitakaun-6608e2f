-- Add ON DELETE CASCADE to transactions table
-- This fixes the issue where deleting a tenant fails because of existing transactions

ALTER TABLE public.transactions
DROP CONSTRAINT transactions_tenant_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(id)
ON DELETE CASCADE;

-- Also verify tenant_locations just in case
ALTER TABLE public.tenant_locations
DROP CONSTRAINT IF EXISTS tenant_locations_tenant_id_fkey;

ALTER TABLE public.tenant_locations
ADD CONSTRAINT tenant_locations_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants(id)
ON DELETE CASCADE;
