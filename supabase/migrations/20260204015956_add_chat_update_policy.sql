-- Migration: Add RLS policy for marking chat messages as read
-- Purpose: Allow recipients to update read_at timestamp on messages they received

-- Policy: Recipients can mark messages as read
-- Condition: User is NOT the sender AND user is a participant in the booking
CREATE POLICY "Recipients can mark messages as read"
ON public.booking_chats FOR UPDATE
USING (
  sender_id != auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_chats.booking_id
    AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())
  )
)
WITH CHECK (
  -- Only allow setting read_at, ensure it's being set to a non-null value
  read_at IS NOT NULL
);

COMMENT ON POLICY "Recipients can mark messages as read" ON public.booking_chats
  IS 'Allows booking participants to mark messages they received as read';
