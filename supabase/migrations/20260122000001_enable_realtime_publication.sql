-- Enable Supabase Realtime for key booking-related tables
-- This is required for postgres_changes events to fire

-- Enable realtime for bookings table (status updates, provider assignments)
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Enable realtime for notifications table (new notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for booking_timeline table (status timeline events)
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_timeline;

-- Enable realtime for booking_gps_logs table (provider location tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_gps_logs;

-- Enable realtime for booking_chats table (chat messages)
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_chats;

-- Comment for documentation
COMMENT ON PUBLICATION supabase_realtime IS 'Supabase Realtime publication for postgres_changes. Tables: bookings, notifications, booking_timeline, booking_gps_logs, booking_chats';
