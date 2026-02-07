-- Create a function to handle public payment transactions
-- This bypasses RLS because it runs with the privileges of the function owner

CREATE OR REPLACE FUNCTION create_public_payment_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_organizer_id UUID,
    p_location_id INTEGER,
    p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges, bypassing RLS
SET search_path = public
AS $$
DECLARE
    v_transaction_id UUID;
    v_result JSONB;
BEGIN
    INSERT INTO organizer_transactions (
        description,
        amount,
        type,
        category,
        status,
        date,
        organizer_id,
        location_id,
        is_auto_generated,
        metadata
    ) VALUES (
        p_description,
        p_amount,
        'income',
        'Sewa',
        'pending',
        CURRENT_DATE,
        p_organizer_id,
        p_location_id,
        false,
        p_metadata
    )
    RETURNING id INTO v_transaction_id;
    
    v_result := jsonb_build_object(
        'id', v_transaction_id,
        'success', true
    );
    
    RETURN v_result;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION create_public_payment_transaction TO anon;
GRANT EXECUTE ON FUNCTION create_public_payment_transaction TO authenticated;

-- Create a function to update payment reference
CREATE OR REPLACE FUNCTION update_payment_transaction_ref(
    p_transaction_id UUID,
    p_payment_ref TEXT,
    p_receipt_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE organizer_transactions
    SET 
        payment_reference = p_payment_ref,
        receipt_url = p_receipt_url,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    v_result := jsonb_build_object(
        'success', true
    );
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_payment_transaction_ref TO anon;
GRANT EXECUTE ON FUNCTION update_payment_transaction_ref TO authenticated;

-- Create a function to update transaction status
CREATE OR REPLACE FUNCTION update_transaction_status(
    p_transaction_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    UPDATE organizer_transactions
    SET 
        status = p_status,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    v_result := jsonb_build_object(
        'success', true
    );
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_transaction_status TO anon;
GRANT EXECUTE ON FUNCTION update_transaction_status TO authenticated;
