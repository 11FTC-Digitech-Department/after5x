-- Add completed_at column to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update update_booking_payment_status to set completed_at when status becomes completed
CREATE OR REPLACE FUNCTION update_booking_payment_status(
  p_booking_id UUID,
  p_new_status TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE public.bookings
  SET status = p_new_status::booking_status,
      updated_at = NOW(),
      completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END
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

-- Backfill completed_at for existing completed bookings
UPDATE public.bookings
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;

-- Add partial index for completed bookings
CREATE INDEX IF NOT EXISTS idx_bookings_completed_at ON public.bookings(completed_at) WHERE completed_at IS NOT NULL;
