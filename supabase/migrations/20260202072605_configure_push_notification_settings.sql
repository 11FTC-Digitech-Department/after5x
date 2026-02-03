-- Configure Push Notification Settings
-- This migration updates the send_push_notification_async function to work with local development
-- without requiring superuser privileges to set database parameters.

-- ============================================================================
-- Function: send_push_notification_async (updated)
-- Now includes hardcoded local development defaults when settings are not available
-- ============================================================================
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
SET search_path = public, extensions
AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_key TEXT;
    v_request_id BIGINT;
    v_is_local BOOLEAN;
BEGIN
    -- Get Supabase URL and service key from environment
    -- These should be set via Supabase secrets or vault in production
    v_supabase_url := current_setting('app.supabase_url', TRUE);
    v_service_key := current_setting('app.supabase_service_key', TRUE);

    -- Detect if we're in local development by checking for local indicators
    -- In local Supabase, certain system settings or patterns can identify the environment
    v_is_local := (v_supabase_url IS NULL OR v_supabase_url LIKE '%localhost%' OR v_supabase_url LIKE '%host.docker.internal%');

    -- Apply local development defaults if settings are not configured
    IF v_supabase_url IS NULL THEN
        -- For local development, use the docker internal URL
        v_supabase_url := 'http://host.docker.internal:54321';
    END IF;

    IF v_service_key IS NULL THEN
        -- Check if we appear to be in local development
        -- Use the standard local Supabase service role key
        -- This is safe because:
        -- 1. This key is public and documented (local dev only)
        -- 2. It only works against local Supabase instances
        -- 3. Production should have proper settings configured
        v_service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
        RAISE NOTICE 'Using local development service key for push notifications';
    END IF;

    -- Make async HTTP POST request to Edge Function
    SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
            'userIds', p_user_ids,
            'notification', jsonb_build_object(
                'type', p_type,
                'title', p_title,
                'body', p_body,
                'data', jsonb_build_object('booking_id', p_booking_id::TEXT)
            ),
            'options', jsonb_build_object('appType', p_app_type)
        )
    ) INTO v_request_id;

    RAISE NOTICE 'Push notification request queued: % (request_id: %, url: %)', p_type, v_request_id, v_supabase_url;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to queue push notification: % (Error: %)', p_type, SQLERRM;
END;
$$;

-- Grant permissions for the updated function
GRANT EXECUTE ON FUNCTION send_push_notification_async(UUID[], TEXT, TEXT, TEXT, UUID, TEXT) TO postgres, service_role;

-- ============================================================================
-- PRODUCTION SETUP INSTRUCTIONS
-- ============================================================================
-- For production, you MUST configure proper settings. Options:
--
-- Option 1: Set database parameters (requires superuser)
--   ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
--   ALTER DATABASE postgres SET app.supabase_service_key = 'your-service-role-key';
--
-- Option 2: Use Supabase Vault (recommended for production)
--   Store secrets in vault and retrieve them in the function
--
-- Option 3: Configure via Supabase Dashboard
--   Go to Database > Extensions > Configuration
-- ============================================================================
