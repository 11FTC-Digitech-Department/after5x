-- Remove the booking status notification trigger and function
-- Notifications are now handled by the Angular NotificationService which:
--   - Supports multiple channels (push, SMS, email, in-app)
--   - Notifies both customers AND providers
--   - Logs notification events to notification_logs
--
-- The old trigger was inserting without 'type' and 'message' columns,
-- which now have NOT NULL constraints (added in 20260115041654_add_notifications_and_logs.sql)

DROP TRIGGER IF EXISTS trigger_notify_customer_status ON public.bookings;
DROP FUNCTION IF EXISTS public.handle_booking_status_change();
