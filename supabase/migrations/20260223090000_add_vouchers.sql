-- Vouchers and redemption tracking

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_status') THEN
    CREATE TYPE voucher_status AS ENUM ('active', 'disabled', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voucher_discount_type') THEN
    CREATE TYPE voucher_discount_type AS ENUM ('amount', 'percent');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  status voucher_status NOT NULL DEFAULT 'active',
  discount_type voucher_discount_type NOT NULL DEFAULT 'amount',
  amount DECIMAL(12,2),
  percent_off DECIMAL(5,2),
  max_discount DECIMAL(12,2),
  currency TEXT NOT NULL DEFAULT 'PHP',
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  max_redemptions INT,
  per_user_limit INT,
  min_grand_total DECIMAL(12,2),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT vouchers_code_unique UNIQUE (code),
  CONSTRAINT vouchers_code_uppercase CHECK (code = upper(code)),
  CONSTRAINT vouchers_amount_or_percent_check CHECK (
    (discount_type = 'amount' AND amount IS NOT NULL AND amount > 0 AND (percent_off IS NULL OR percent_off = 0)) OR
    (discount_type = 'percent' AND percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100)
  )
);

CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_validity ON public.vouchers(valid_from, valid_to);

ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS discount_type voucher_discount_type NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS percent_off DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS max_discount DECIMAL(12,2);

ALTER TABLE public.vouchers
  ALTER COLUMN amount DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vouchers_amount_or_percent_check'
  ) THEN
    ALTER TABLE public.vouchers
      ADD CONSTRAINT vouchers_amount_or_percent_check CHECK (
        (discount_type = 'amount' AND amount IS NOT NULL AND amount > 0 AND (percent_off IS NULL OR percent_off = 0)) OR
        (discount_type = 'percent' AND percent_off IS NOT NULL AND percent_off > 0 AND percent_off <= 100)
      );
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.vouchers(id),
  ADD COLUMN IF NOT EXISTS voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS voucher_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS voucher_discount_type voucher_discount_type,
  ADD COLUMN IF NOT EXISTS voucher_percent_off DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS voucher_max_discount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS grand_total_before_voucher DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS grand_total_after_voucher DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS idx_bookings_voucher_id ON public.bookings(voucher_id);

CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE RESTRICT NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  redeemed_amount DECIMAL(12,2) NOT NULL,
  grand_total_before DECIMAL(12,2) NOT NULL,
  grand_total_after DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'redeemed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT voucher_redemptions_booking_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher ON public.voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_customer ON public.voucher_redemptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_created ON public.voucher_redemptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_redeemed ON public.voucher_redemptions(voucher_id) WHERE status = 'redeemed';
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_customer_redeemed ON public.voucher_redemptions(customer_id) WHERE status = 'redeemed';

CREATE TABLE IF NOT EXISTS public.voucher_redemption_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  attempted_code TEXT,
  status TEXT NOT NULL, -- 'success' | 'failed'
  reason_code TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voucher_logs_voucher ON public.voucher_redemption_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_logs_booking ON public.voucher_redemption_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_voucher_logs_customer ON public.voucher_redemption_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_voucher_logs_created ON public.voucher_redemption_logs(created_at DESC);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemption_logs ENABLE ROW LEVEL SECURITY;

-- Vouchers managed by admins only
DROP POLICY IF EXISTS "Admins manage vouchers" ON public.vouchers;
CREATE POLICY "Admins manage vouchers" ON public.vouchers
  FOR ALL USING (public.is_admin());

-- Customers can view their own redemptions; admins can view all
DROP POLICY IF EXISTS "Customers view own voucher redemptions" ON public.voucher_redemptions;
CREATE POLICY "Customers view own voucher redemptions" ON public.voucher_redemptions
  FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());

-- Admins can view all voucher logs
DROP POLICY IF EXISTS "Admins view voucher logs" ON public.voucher_redemption_logs;
CREATE POLICY "Admins view voucher logs" ON public.voucher_redemption_logs
  FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_voucher_attempt(
  p_voucher_id UUID,
  p_booking_id UUID,
  p_customer_id UUID,
  p_code TEXT,
  p_status TEXT,
  p_reason TEXT,
  p_error TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.voucher_redemption_logs (
    voucher_id,
    booking_id,
    customer_id,
    attempted_code,
    status,
    reason_code,
    error_message,
    metadata
  ) VALUES (
    p_voucher_id,
    p_booking_id,
    p_customer_id,
    p_code,
    p_status,
    p_reason,
    p_error,
    COALESCE(p_metadata, '{}')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher(
  p_booking_id UUID,
  p_code TEXT
) RETURNS TABLE (
  voucher_id UUID,
  voucher_code TEXT,
  voucher_amount DECIMAL(12,2),
  grand_total_before DECIMAL(12,2),
  grand_total_after DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_voucher RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_discount DECIMAL(12,2);
  v_after DECIMAL(12,2);
  v_redemption_count INT;
  v_user_redemption_count INT;
  v_code TEXT := upper(trim(p_code));
  v_booking_total DECIMAL(12,2);
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    PERFORM public.log_voucher_attempt(NULL, NULL, auth.uid(), p_code, 'failed', 'missing_code', NULL, jsonb_build_object('booking_id', p_booking_id));
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    PERFORM public.log_voucher_attempt(NULL, NULL, auth.uid(), v_code, 'failed', 'booking_not_found', NULL, jsonb_build_object('booking_id', p_booking_id));
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  v_booking_total := COALESCE(v_booking.grand_total, 0);

  IF v_booking.customer_id <> auth.uid() THEN
    PERFORM public.log_voucher_attempt(NULL, p_booking_id, auth.uid(), v_code, 'failed', 'unauthorized', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_booking.status <> 'payment_pending' THEN
    PERFORM public.log_voucher_attempt(NULL, p_booking_id, auth.uid(), v_code, 'failed', 'invalid_booking_status', v_booking.status::TEXT);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_booking.voucher_id IS NOT NULL OR v_booking.grand_total_after_voucher IS NOT NULL THEN
    PERFORM public.log_voucher_attempt(v_booking.voucher_id, p_booking_id, auth.uid(), v_booking.voucher_code, 'failed', 'already_redeemed', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  SELECT * INTO v_voucher
  FROM public.vouchers
  WHERE code = v_code
  LIMIT 1;

  IF v_voucher IS NULL THEN
    PERFORM public.log_voucher_attempt(NULL, p_booking_id, auth.uid(), v_code, 'failed', 'code_not_found', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.status <> 'active' THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'inactive', v_voucher.status::TEXT);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.valid_from IS NOT NULL AND v_now < v_voucher.valid_from THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'not_started', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.valid_to IS NOT NULL AND v_now > v_voucher.valid_to THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'expired', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.min_grand_total IS NOT NULL AND v_booking_total < v_voucher.min_grand_total THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'min_total_not_met', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.discount_type = 'amount' THEN
    IF v_voucher.amount IS NULL OR v_voucher.amount <= 0 THEN
      PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'invalid_amount', NULL);
      RAISE EXCEPTION 'INVALID_VOUCHER';
    END IF;
  ELSE
    IF v_voucher.percent_off IS NULL OR v_voucher.percent_off <= 0 OR v_voucher.percent_off > 100 THEN
      PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'invalid_percent', NULL);
      RAISE EXCEPTION 'INVALID_VOUCHER';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_redemption_count
  FROM public.voucher_redemptions vr
  WHERE vr.voucher_id = v_voucher.id
    AND vr.status = 'redeemed';

  IF v_voucher.max_redemptions IS NOT NULL AND v_redemption_count >= v_voucher.max_redemptions THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'max_redemptions_reached', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  SELECT COUNT(*) INTO v_user_redemption_count
  FROM public.voucher_redemptions vr
  WHERE vr.voucher_id = v_voucher.id
    AND vr.customer_id = v_booking.customer_id
    AND vr.status = 'redeemed';

  IF v_voucher.per_user_limit IS NOT NULL AND v_user_redemption_count >= v_voucher.per_user_limit THEN
    PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'failed', 'per_user_limit', NULL);
    RAISE EXCEPTION 'INVALID_VOUCHER';
  END IF;

  IF v_voucher.discount_type = 'percent' THEN
    v_discount := (v_booking_total * (v_voucher.percent_off / 100.0));
    IF v_voucher.max_discount IS NOT NULL THEN
      v_discount := LEAST(v_discount, v_voucher.max_discount);
    END IF;
  ELSE
    v_discount := v_voucher.amount;
  END IF;

  v_discount := LEAST(v_discount, v_booking_total);
  v_after := GREATEST(v_booking_total - v_discount, 0);

  UPDATE public.bookings
  SET
    voucher_id = v_voucher.id,
    voucher_code = v_voucher.code,
    voucher_amount = v_discount,
    voucher_discount_type = v_voucher.discount_type,
    voucher_percent_off = v_voucher.percent_off,
    voucher_max_discount = v_voucher.max_discount,
    grand_total_before_voucher = v_booking_total,
    grand_total_after_voucher = v_after,
    grand_total = v_after,
    provider_earnings = GREATEST(v_after - COALESCE(platform_fee, 0), 0),
    updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.voucher_redemptions (
    voucher_id,
    booking_id,
    customer_id,
    redeemed_amount,
    grand_total_before,
    grand_total_after,
    status
  ) VALUES (
    v_voucher.id,
    p_booking_id,
    v_booking.customer_id,
    v_discount,
    v_booking_total,
    v_after,
    'redeemed'
  )
  ON CONFLICT (booking_id) DO UPDATE
  SET
    voucher_id = EXCLUDED.voucher_id,
    customer_id = EXCLUDED.customer_id,
    redeemed_amount = EXCLUDED.redeemed_amount,
    grand_total_before = EXCLUDED.grand_total_before,
    grand_total_after = EXCLUDED.grand_total_after,
    status = 'redeemed',
    created_at = NOW();

  PERFORM public.log_voucher_attempt(v_voucher.id, p_booking_id, auth.uid(), v_code, 'success', 'redeemed', NULL);

  RETURN QUERY SELECT v_voucher.id, v_voucher.code, v_discount, v_booking_total, v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_voucher(
  p_booking_id UUID
) RETURNS TABLE (
  booking_id UUID,
  grand_total_before DECIMAL(12,2),
  grand_total_after DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_original_total DECIMAL(12,2);
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'INVALID_BOOKING';
  END IF;

  IF v_booking.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'INVALID_BOOKING';
  END IF;

  IF v_booking.status <> 'payment_pending' THEN
    RAISE EXCEPTION 'INVALID_BOOKING';
  END IF;

  IF v_booking.voucher_id IS NULL THEN
    RAISE EXCEPTION 'NO_VOUCHER_APPLIED';
  END IF;

  v_original_total := COALESCE(v_booking.grand_total_before_voucher, v_booking.grand_total);

  UPDATE public.bookings
  SET
    grand_total = v_original_total,
    provider_earnings = GREATEST(v_original_total - COALESCE(platform_fee, 0), 0),
    voucher_id = NULL,
    voucher_code = NULL,
    voucher_amount = NULL,
    voucher_discount_type = NULL,
    voucher_percent_off = NULL,
    voucher_max_discount = NULL,
    grand_total_before_voucher = NULL,
    grand_total_after_voucher = NULL,
    updated_at = NOW()
  WHERE id = p_booking_id;

  UPDATE public.voucher_redemptions
  SET status = 'reversed'
  WHERE voucher_redemptions.booking_id = p_booking_id
    AND voucher_redemptions.status = 'redeemed';

  PERFORM public.log_voucher_attempt(v_booking.voucher_id, p_booking_id, auth.uid(), v_booking.voucher_code, 'success', 'removed', NULL);

  RETURN QUERY SELECT p_booking_id, COALESCE(v_booking.grand_total, 0), v_original_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_voucher(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_voucher(UUID) TO authenticated;
