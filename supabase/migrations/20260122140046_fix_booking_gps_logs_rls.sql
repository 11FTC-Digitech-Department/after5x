-- Fix RLS policy for booking_gps_logs INSERT
-- The policy should verify that:
-- 1. The authenticated user is the provider (auth.uid() = provider_id)
-- 2. The provider is assigned to the booking (booking.provider_id = auth.uid())

DROP POLICY IF EXISTS "Providers log gps" ON public.booking_gps_logs;

CREATE POLICY "Providers log gps" ON public.booking_gps_logs 
FOR INSERT 
WITH CHECK (
  auth.uid() = provider_id 
  AND EXISTS (
    SELECT 1 
    FROM public.bookings b 
    WHERE b.id = booking_id 
    AND b.provider_id = auth.uid()
  )
);
