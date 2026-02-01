-- Backfill the Pending Transaction into 'transactions' table
-- Required because the 'handle_payment_approval' trigger only copies APPROVED payments.
-- Pending payments need to be here to be visible on the Dashboard.

INSERT INTO public.transactions (
    tenant_id,
    amount,
    type, 
    category,
    status,
    date,
    description,
    receipt_url
) VALUES (
    3, -- Ahmad's ID
    32.00,
    'expense', -- Rent is expense for tenant (Organizer sees as Income)
    'Sewa',
    'pending',
    '2026-02-01',
    'Bayaran Sewa: Tapak Pasar Malam Rabu (Ref: 5063f79df1b47890)',
    'https://www.billplz-sandbox.com/bills/5063f79df1b47890'
);
