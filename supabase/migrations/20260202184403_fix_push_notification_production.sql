-- Fix Push Notification Production Configuration
-- Uses a queue table + database webhook (no secrets stored in DB)

-- Create notification queue table
CREATE TABLE IF NOT EXISTS push_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_ids UUID[] NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    booking_id UUID,
    app_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Index for webhook processing
CREATE INDEX IF NOT EXISTS idx_push_notification_queue_status
ON push_notification_queue(status) WHERE status = 'pending';

-- RLS - service_role only
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON push_notification_queue;
CREATE POLICY "Service role only" ON push_notification_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON push_notification_queue FROM anon, authenticated;
GRANT ALL ON push_notification_queue TO service_role;

-- Update function to queue instead of direct HTTP call
CREATE OR REPLACE FUNCTION send_push_notification_async(
    p_user_ids UUID[],
    p_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_booking_id UUID,
    p_app_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO push_notification_queue (user_ids, type, title, body, booking_id, app_type)
    VALUES (p_user_ids, p_type, p_title, p_body, p_booking_id, p_app_type);

    RAISE NOTICE 'Push notification queued: %', p_type;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to queue push notification: % (Error: %)', p_type, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION send_push_notification_async(UUID[], TEXT, TEXT, TEXT, UUID, TEXT) TO postgres, service_role;

COMMENT ON FUNCTION send_push_notification_async IS
'Queues push notifications for processing by database webhook.
Configure webhook in Supabase Dashboard: Database → Webhooks → pointing to send-push-notification Edge Function.';
