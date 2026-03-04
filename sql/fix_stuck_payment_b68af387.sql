-- Fix stuck Billplz rent payment
-- tenant_payment id: b68af387-8768-4192-ace7-ef993be834f3
-- billplz_id: 50663f8f49f6c843
-- Amount: RM 2.50, Location: 42

-- Step 1: Mark tenant_payment as approved
UPDATE tenant_payments
SET status = 'approved'
WHERE id = 'b68af387-8768-4192-ace7-ef993be834f3'
  AND billplz_id = '50663f8f49f6c843';

-- Step 2: Create organizer_transactions (income for admin@kumim.my)
INSERT INTO organizer_transactions (
    organizer_id, tenant_id, location_id, amount,
    type, category, status, date, description,
    receipt_url, is_auto_generated, is_sandbox, payment_reference
)
SELECT
    tp.organizer_id,
    tp.tenant_id,
    tp.location_id,
    tp.amount,
    'income',
    'Sewa',
    'approved',
    DATE(tp.payment_date),
    'Bayaran Sewa/Permit dari: ' || COALESCE(t.full_name, 'Peniaga') ||
        COALESCE(' - ' || l.name, '') || ' (Ref: ' || tp.billplz_id || ')',
    tp.receipt_url,
    true,
    false,
    tp.billplz_id
FROM tenant_payments tp
JOIN tenants t ON t.id = tp.tenant_id
LEFT JOIN locations l ON l.id = tp.location_id
WHERE tp.id = 'b68af387-8768-4192-ace7-ef993be834f3'
  AND NOT EXISTS (
    SELECT 1 FROM organizer_transactions ot
    WHERE ot.payment_reference = '50663f8f49f6c843'
  );

-- Step 3: Create tenant_transactions (expense for tenant)
INSERT INTO tenant_transactions (
    tenant_id, profile_id, organizer_id, location_id, amount,
    type, category, status, date, description,
    receipt_url, is_rent_payment, is_sandbox, payment_reference
)
SELECT
    tp.tenant_id,
    t.profile_id,
    tp.organizer_id,
    tp.location_id,
    tp.amount,
    'expense',
    'Sewa',
    'approved',
    DATE(tp.payment_date),
    'Bayaran Sewa/Permit' || COALESCE(' - ' || l.name, '') || ' (Ref: ' || tp.billplz_id || ')',
    tp.receipt_url,
    true,
    false,
    tp.billplz_id
FROM tenant_payments tp
JOIN tenants t ON t.id = tp.tenant_id
LEFT JOIN locations l ON l.id = tp.location_id
WHERE tp.id = 'b68af387-8768-4192-ace7-ef993be834f3'
  AND NOT EXISTS (
    SELECT 1 FROM tenant_transactions tt
    WHERE tt.payment_reference = '50663f8f49f6c843'
      AND tt.is_rent_payment = true
  );

-- Verify results
SELECT
    tp.id, tp.amount, tp.status, tp.billplz_id,
    ot.id AS org_tx_id, ot.status AS org_status,
    tt.id AS tenant_tx_id, tt.status AS tenant_status
FROM tenant_payments tp
LEFT JOIN organizer_transactions ot ON ot.payment_reference = tp.billplz_id
LEFT JOIN tenant_transactions tt ON tt.payment_reference = tp.billplz_id AND tt.is_rent_payment = true
WHERE tp.id = 'b68af387-8768-4192-ace7-ef993be834f3';
