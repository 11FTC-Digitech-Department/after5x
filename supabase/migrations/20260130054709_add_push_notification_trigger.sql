-- Push Notification Trigger Migration
-- Enables pg_net extension and creates trigger to send push notifications on booking status changes

-- Enable pg_net extension for HTTP calls from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- Function: send_push_notification_async
-- Helper function to call the push notification Edge Function asynchronously
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
BEGIN
    -- Get Supabase URL and service key from environment
    -- These should be set via Supabase secrets or vault
    v_supabase_url := current_setting('app.supabase_url', TRUE);
    v_service_key := current_setting('app.supabase_service_key', TRUE);

    -- If settings are not available, try to construct from known values
    IF v_supabase_url IS NULL THEN
        -- For local development, use the local API URL
        v_supabase_url := 'http://host.docker.internal:54321';
    END IF;

    -- Skip if we don't have the required settings
    IF v_service_key IS NULL THEN
        RAISE NOTICE 'Push notification skipped: service key not configured';
        RETURN;
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

    RAISE NOTICE 'Push notification request queued: % (request_id: %)', p_type, v_request_id;

EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to queue push notification: % (Error: %)', p_type, SQLERRM;
END;
$$;

-- ============================================================================
-- Function: notify_booking_status_change_push
-- Trigger function that sends push notifications on booking status changes
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_booking_status_change_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_notification_type TEXT;
    v_notification_title TEXT;
    v_notification_body TEXT;
    v_target_user_id UUID;
    v_app_type TEXT;
    v_provider_name TEXT;
    v_booking_ref TEXT;
BEGIN
    -- Skip if status hasn't changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get short booking reference for notifications
    v_booking_ref := UPPER(SUBSTRING(NEW.id::TEXT FROM 1 FOR 8));

    -- Get provider name if assigned
    IF NEW.provider_id IS NOT NULL THEN
        SELECT p.full_name INTO v_provider_name
        FROM profiles p
        WHERE p.id = NEW.provider_id;
    END IF;

    -- Determine notification based on new status
    CASE NEW.status
        -- Provider receives new job request
        WHEN 'pending_acceptance' THEN
            IF NEW.provider_id IS NOT NULL THEN
                v_notification_type := 'new_job';
                v_notification_title := 'New Job Request';
                v_notification_body := 'You have a new service request. Tap to view details.';
                v_target_user_id := NEW.provider_id;
                v_app_type := 'experts';
            END IF;

        -- Customer: booking confirmed by provider
        WHEN 'confirmed' THEN
            -- Notify customer
            v_notification_type := 'booking_confirmed';
            v_notification_title := 'Booking Confirmed';
            v_notification_body := COALESCE(v_provider_name, 'Your provider') || ' has accepted your booking.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

            -- Also notify provider (job confirmed)
            PERFORM send_push_notification_async(
                ARRAY[NEW.provider_id],
                'job_confirmed',
                'Job Confirmed',
                'The booking has been confirmed. Get ready for the service.',
                NEW.id,
                'experts'
            );

        -- Customer: provider on the way
        WHEN 'on_the_way' THEN
            v_notification_type := 'provider_on_way';
            v_notification_title := 'Provider On the Way';
            v_notification_body := COALESCE(v_provider_name, 'Your provider') || ' is heading to your location.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        -- Customer: provider arrived
        WHEN 'arrived' THEN
            v_notification_type := 'provider_arrived';
            v_notification_title := 'Provider Arrived';
            v_notification_body := COALESCE(v_provider_name, 'Your provider') || ' has arrived at your location.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        -- Customer: service started
        WHEN 'in_progress' THEN
            v_notification_type := 'booking_started';
            v_notification_title := 'Service Started';
            v_notification_body := 'Your service has begun. We''ll notify you when it''s complete.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        -- Customer: payment pending
        WHEN 'payment_pending' THEN
            v_notification_type := 'booking_completed';
            v_notification_title := 'Service Complete';
            v_notification_body := 'Your service is complete. Please proceed with payment.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        -- Provider: payment received
        WHEN 'paid' THEN
            v_notification_type := 'payment_received';
            v_notification_title := 'Payment Received';
            v_notification_body := 'Payment for booking #' || v_booking_ref || ' has been received.';
            v_target_user_id := NEW.provider_id;
            v_app_type := 'experts';

        -- Customer: booking completed
        WHEN 'completed' THEN
            v_notification_type := 'booking_completed';
            v_notification_title := 'Booking Completed';
            v_notification_body := 'Thank you for using After5! We hope you enjoyed the service.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        -- Cancellation notifications
        WHEN 'cancelled' THEN
            -- Determine who initiated the cancellation
            IF NEW.cancelled_by = NEW.customer_id THEN
                -- Customer cancelled - notify provider
                v_notification_type := 'job_cancelled';
                v_notification_title := 'Job Cancelled';
                v_notification_body := 'Booking #' || v_booking_ref || ' has been cancelled by the customer.';
                v_target_user_id := NEW.provider_id;
                v_app_type := 'experts';
            ELSE
                -- Provider cancelled - notify customer
                v_notification_type := 'booking_cancelled';
                v_notification_title := 'Booking Cancelled';
                v_notification_body := 'Your booking #' || v_booking_ref || ' has been cancelled.';
                v_target_user_id := NEW.customer_id;
                v_app_type := 'customer';
            END IF;

        -- Provider rejected
        WHEN 'rejected' THEN
            v_notification_type := 'booking_cancelled';
            v_notification_title := 'Booking Not Accepted';
            v_notification_body := 'Your booking request was not accepted. Please try again.';
            v_target_user_id := NEW.customer_id;
            v_app_type := 'customer';

        ELSE
            -- No notification for other status changes
            RETURN NEW;
    END CASE;

    -- Send the primary notification if we have a target user
    IF v_target_user_id IS NOT NULL AND v_notification_type IS NOT NULL THEN
        PERFORM send_push_notification_async(
            ARRAY[v_target_user_id],
            v_notification_type,
            v_notification_title,
            v_notification_body,
            NEW.id,
            v_app_type
        );
    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================================
-- Create the trigger
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_push_notification_on_booking_status ON public.bookings;

CREATE TRIGGER trigger_push_notification_on_booking_status
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_status_change_push();

-- ============================================================================
-- Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, service_role;
GRANT EXECUTE ON FUNCTION send_push_notification_async(UUID[], TEXT, TEXT, TEXT, UUID, TEXT) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION notify_booking_status_change_push() TO postgres, service_role;
