-- Enable REPLICA IDENTITY FULL for realtime UPDATE events
-- This is REQUIRED for Supabase Realtime to:
-- 1. Include the 'old' record data in UPDATE payloads
-- 2. Match filter conditions like `customer_id=eq.${customerId}` on UPDATE events
--
-- Without REPLICA IDENTITY FULL, UPDATE events may not fire for filtered subscriptions
-- because PostgreSQL only sends the primary key by default, not the customer_id column.

-- Enable for bookings table (status updates, provider assignments)
ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- Enable for booking_timeline table (status timeline events)
ALTER TABLE public.booking_timeline REPLICA IDENTITY FULL;

-- Enable for notifications table (notification updates)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Enable for booking_chats table (chat message updates)
ALTER TABLE public.booking_chats REPLICA IDENTITY FULL;

-- Enable for booking_gps_logs table (location tracking updates)
ALTER TABLE public.booking_gps_logs REPLICA IDENTITY FULL;

-- Comment for documentation
COMMENT ON TABLE public.bookings IS 'Bookings table with REPLICA IDENTITY FULL for realtime UPDATE events';
