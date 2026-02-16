-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role (required for scheduling)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule daily cleanup at 3 AM UTC
-- Deletes processed/failed records older than 7 days
SELECT cron.schedule(
  'cleanup-push-notification-queue',
  '0 3 * * *',
  $$DELETE FROM public.push_notification_queue
    WHERE status IN ('processed', 'failed')
    AND processed_at < now() - interval '7 days'$$
);
