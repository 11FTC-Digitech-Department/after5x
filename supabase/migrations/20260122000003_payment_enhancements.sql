-- Payment Enhancement Migration
-- Adds support for Xendit Invoice-based payments

-- 1. Payment method types supported by Xendit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM (
      'EWALLET', 'CARD', 'BANK_TRANSFER', 'RETAIL_OUTLET', 'QR_CODE'
    );
  END IF;
END$$;

-- 2. Enhance invoices table with Xendit payment details
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method_type payment_method_type,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT, -- e.g., 'GCASH', 'BPI', 'VISA'
  ADD COLUMN IF NOT EXISTS fees_paid_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xendit_external_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Wallet transactions for audit trail
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID REFERENCES public.wallets(id) NOT NULL,
  booking_id UUID REFERENCES public.bookings(id),
  invoice_id UUID REFERENCES public.invoices(id),
  type TEXT CHECK (type IN ('CREDIT', 'DEBIT', 'WITHDRAWAL', 'ADJUSTMENT')) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes for wallet transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_booking ON public.wallet_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON public.wallet_transactions(created_at DESC);

-- 5. Index for invoice lookups by Xendit ID
CREATE INDEX IF NOT EXISTS idx_invoices_xendit_id ON public.invoices(xendit_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_external_id ON public.invoices(xendit_external_id);

-- 6. Enable RLS on wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for wallet_transactions
DROP POLICY IF EXISTS "Providers can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Providers can view own wallet transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (
    wallet_id IN (
      SELECT w.id FROM public.wallets w
      WHERE w.owner_id = auth.uid() AND w.owner_type = 'provider'
    )
  );

-- 8. Function to credit provider wallet atomically
CREATE OR REPLACE FUNCTION credit_provider_wallet(
  p_booking_id UUID,
  p_invoice_id UUID
) RETURNS VOID AS $$
DECLARE
  v_booking RECORD;
  v_wallet_id UUID;
  v_new_balance DECIMAL(12,2);
BEGIN
  -- Get booking and provider earnings
  SELECT provider_id, provider_earnings INTO v_booking
  FROM public.bookings WHERE id = p_booking_id;

  IF v_booking.provider_id IS NULL THEN
    RAISE EXCEPTION 'Booking has no provider assigned';
  END IF;

  IF v_booking.provider_earnings IS NULL OR v_booking.provider_earnings <= 0 THEN
    RAISE EXCEPTION 'Invalid provider earnings amount';
  END IF;

  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM public.wallets
  WHERE owner_id = v_booking.provider_id AND owner_type = 'provider';

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (owner_id, owner_type, balance, currency)
    VALUES (v_booking.provider_id, 'provider', 0, 'PHP')
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance = balance + v_booking.provider_earnings,
      last_transaction_at = NOW(),
      updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.wallet_transactions
    (wallet_id, booking_id, invoice_id, type, amount, balance_after, description)
  VALUES
    (v_wallet_id, p_booking_id, p_invoice_id, 'CREDIT', v_booking.provider_earnings,
     v_new_balance, 'Payment for booking #' || LEFT(p_booking_id::TEXT, 8));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get or create Xendit customer ID
CREATE OR REPLACE FUNCTION get_or_create_xendit_customer(
  p_customer_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_xendit_id TEXT;
BEGIN
  SELECT xendit_customer_id INTO v_xendit_id
  FROM public.customers
  WHERE id = p_customer_id;

  RETURN v_xendit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to update Xendit customer ID
CREATE OR REPLACE FUNCTION update_xendit_customer_id(
  p_customer_id UUID,
  p_xendit_customer_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.customers
  SET xendit_customer_id = p_xendit_customer_id,
      updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to create invoice record
CREATE OR REPLACE FUNCTION create_invoice_record(
  p_booking_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL(12,2),
  p_xendit_invoice_id TEXT,
  p_xendit_invoice_url TEXT,
  p_xendit_external_id TEXT,
  p_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  INSERT INTO public.invoices (
    booking_id,
    customer_id,
    amount,
    xendit_invoice_id,
    xendit_invoice_url,
    xendit_external_id,
    expires_at,
    status
  ) VALUES (
    p_booking_id,
    p_customer_id,
    p_amount,
    p_xendit_invoice_id,
    p_xendit_invoice_url,
    p_xendit_external_id,
    p_expires_at,
    'PENDING'
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to update invoice status after payment
CREATE OR REPLACE FUNCTION update_invoice_paid(
  p_xendit_invoice_id TEXT,
  p_payment_method TEXT,
  p_payment_method_type payment_method_type,
  p_payment_channel TEXT,
  p_fees_paid DECIMAL(12,2)
) RETURNS UUID AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  UPDATE public.invoices
  SET status = 'PAID',
      payment_method = p_payment_method,
      payment_method_type = p_payment_method_type,
      payment_channel = p_payment_channel,
      fees_paid_amount = p_fees_paid,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE xendit_invoice_id = p_xendit_invoice_id
  RETURNING * INTO v_invoice;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_xendit_invoice_id;
  END IF;

  RETURN v_invoice.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to update invoice status to expired
CREATE OR REPLACE FUNCTION update_invoice_expired(
  p_xendit_invoice_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  UPDATE public.invoices
  SET status = 'EXPIRED',
      updated_at = NOW()
  WHERE xendit_invoice_id = p_xendit_invoice_id
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to update booking status after payment
CREATE OR REPLACE FUNCTION update_booking_payment_status(
  p_booking_id UUID,
  p_new_status TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.bookings
  SET status = p_new_status::booking_status,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- Create timeline entry
  INSERT INTO public.booking_timeline (booking_id, title, description, icon_name)
  VALUES (
    p_booking_id,
    CASE p_new_status
      WHEN 'paid' THEN 'Payment Received'
      WHEN 'completed' THEN 'Service Completed'
      ELSE 'Status Updated'
    END,
    CASE p_new_status
      WHEN 'paid' THEN 'Payment has been confirmed successfully.'
      WHEN 'completed' THEN 'Your service has been completed. Thank you!'
      ELSE 'Booking status has been updated.'
    END,
    CASE p_new_status
      WHEN 'paid' THEN 'checkmark-circle'
      WHEN 'completed' THEN 'checkmark-done-circle'
      ELSE 'information-circle'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Function to get invoice by booking ID
CREATE OR REPLACE FUNCTION get_invoice_by_booking(
  p_booking_id UUID
) RETURNS TABLE (
  id UUID,
  xendit_invoice_id TEXT,
  xendit_invoice_url TEXT,
  amount DECIMAL(12,2),
  status invoice_status,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_channel TEXT,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.xendit_invoice_id,
    i.xendit_invoice_url,
    i.amount,
    i.status,
    i.paid_at,
    i.payment_method,
    i.payment_channel,
    i.expires_at
  FROM public.invoices i
  WHERE i.booking_id = p_booking_id
  ORDER BY i.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Function to get provider wallet with transaction history
CREATE OR REPLACE FUNCTION get_provider_wallet(
  p_provider_id UUID
) RETURNS TABLE (
  wallet_id UUID,
  balance DECIMAL(12,2),
  frozen_balance DECIMAL(12,2),
  currency TEXT,
  last_transaction_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.balance,
    w.frozen_balance,
    w.currency,
    w.last_transaction_at
  FROM public.wallets w
  WHERE w.owner_id = p_provider_id AND w.owner_type = 'provider';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. Function to get wallet transactions
CREATE OR REPLACE FUNCTION get_wallet_transactions(
  p_provider_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  type TEXT,
  amount DECIMAL(12,2),
  balance_after DECIMAL(12,2),
  description TEXT,
  booking_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wt.id,
    wt.type,
    wt.amount,
    wt.balance_after,
    wt.description,
    wt.booking_id,
    wt.created_at
  FROM public.wallet_transactions wt
  INNER JOIN public.wallets w ON wt.wallet_id = w.id
  WHERE w.owner_id = p_provider_id AND w.owner_type = 'provider'
  ORDER BY wt.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Enable realtime for invoices and wallet_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;

-- 19. Add replica identity for realtime to work properly
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;

-- 20. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION credit_provider_wallet(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_xendit_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_xendit_customer_id(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_record(UUID, UUID, DECIMAL, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION update_invoice_paid(TEXT, TEXT, payment_method_type, TEXT, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION update_invoice_expired(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_booking_payment_status(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_invoice_by_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_provider_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wallet_transactions(UUID, INT, INT) TO authenticated;
