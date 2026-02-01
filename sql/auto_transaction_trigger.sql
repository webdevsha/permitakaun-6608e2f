-- Trigger function to auto-create transaction on payment approval
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO public.transactions (
      tenant_id,
      amount,
      type,
      category,
      status,
      date,
      description,
      receipt_url,
      is_sandbox
    ) VALUES (
      NEW.tenant_id,
      NEW.amount,
      'expense', -- Rent is an EXPENSE for the tenant
      'Sewa',    -- Category
      'approved',
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'Bayaran Sewa/Permit (Auto-Generated)',
      NEW.receipt_url,
      NEW.is_sandbox
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_payment_approved ON public.tenant_payments;

-- Create Trigger
CREATE TRIGGER on_payment_approved
AFTER UPDATE ON public.tenant_payments
FOR EACH ROW
EXECUTE PROCEDURE public.handle_payment_approval();
