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
      description
    ) VALUES (
      NEW.tenant_id,
      NEW.amount,
      'income',
      'Sewa', -- Default category for payments
      'approved',
      COALESCE(NEW.payment_date, CURRENT_DATE),
      'Bayaran Sewa/Permit (Auto-Generated)'
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
EXECUTE COMPLETED PROCEDURE public.handle_payment_approval();
