-- Check all public payments (from /bayar) in organizer_transactions
SELECT 
    t.id,
    t.description,
    t.amount,
    t.type,
    t.category,
    t.status,
    t.date,
    t.payment_reference,
    t.metadata->>'payer_name' as payer_name,
    t.metadata->>'payer_phone' as payer_phone,
    t.metadata->>'payer_email' as payer_email,
    t.metadata->>'location_name' as location_name,
    t.metadata->>'organizer_code' as organizer_code,
    o.name as organizer_name,
    t.created_at
FROM organizer_transactions t
LEFT JOIN organizers o ON t.organizer_id = o.id
WHERE t.metadata->>'is_public_payment' = 'true'
   OR t.description LIKE '%Bayaran Sewa%'
ORDER BY t.created_at DESC
LIMIT 20;

-- Check total income by organizer from public payments
SELECT 
    o.name as organizer_name,
    o.organizer_code,
    COUNT(*) as total_payments,
    SUM(t.amount) as total_amount
FROM organizer_transactions t
JOIN organizers o ON t.organizer_id = o.id
WHERE t.type = 'income'
  AND t.status = 'completed'
  AND (t.metadata->>'is_public_payment' = 'true' OR t.description LIKE '%Bayaran Sewa%')
GROUP BY o.id, o.name, o.organizer_code
ORDER BY total_amount DESC;

-- Check recent completed payments
SELECT 
    t.id,
    t.amount,
    t.status,
    t.payment_reference,
    t.metadata->>'payer_name' as payer_name,
    o.name as organizer_name,
    t.created_at
FROM organizer_transactions t
JOIN organizers o ON t.organizer_id = o.id
WHERE t.status = 'completed'
ORDER BY t.created_at DESC
LIMIT 10;
