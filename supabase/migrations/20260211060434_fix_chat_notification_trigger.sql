-- Fix chat notification trigger to use the webhook queue (send_push_notification_async)
-- instead of direct net.http_post() via vault secrets which silently fails.
--
-- This aligns chat notifications with the booking notification flow:
-- DB trigger → send_push_notification_async() → push_notification_queue → Webhook → Edge Function → FCM

CREATE OR REPLACE FUNCTION notify_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id UUID;
  v_booking_record RECORD;
  v_sender_name TEXT;
  v_message_preview TEXT;
  v_should_notify BOOLEAN;
  v_app_type TEXT;
BEGIN
  -- Get booking details and sender name
  SELECT b.customer_id, b.provider_id, p.full_name AS sender_name
  INTO v_booking_record
  FROM bookings b
  JOIN profiles p ON p.id = NEW.sender_id
  WHERE b.id = NEW.booking_id;

  -- Determine recipient (the other participant)
  IF v_booking_record.customer_id = NEW.sender_id THEN
    v_recipient_id := v_booking_record.provider_id;
    v_app_type := 'experts';
  ELSE
    v_recipient_id := v_booking_record.customer_id;
    v_app_type := 'customer';
  END IF;

  -- Skip if no recipient (edge case: provider not yet assigned)
  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_sender_name := COALESCE(v_booking_record.sender_name, 'Someone');

  -- Build message preview
  v_message_preview := CASE
    WHEN NEW.message_type = 'IMAGE' THEN 'Sent a photo'
    ELSE LEFT(NEW.content, 100)
  END;

  -- Check if recipient has chat notifications enabled and not in quiet hours
  SELECT
    COALESCE(np.chat_messages, true)
    AND NOT COALESCE(is_within_chat_quiet_hours(v_recipient_id), false)
  INTO v_should_notify
  FROM notification_preferences np
  WHERE np.user_id = v_recipient_id;

  -- Default to true if no preferences exist
  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;

  -- Queue push notification via the webhook infrastructure
  IF v_should_notify THEN
    PERFORM send_push_notification_async(
      ARRAY[v_recipient_id],
      'chat_message',
      v_sender_name,
      v_message_preview,
      NEW.booking_id,
      v_app_type
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Chat notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
