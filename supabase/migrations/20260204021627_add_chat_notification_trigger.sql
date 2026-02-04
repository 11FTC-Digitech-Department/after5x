-- Migration: Add chat notification trigger
-- Purpose: Trigger Edge Function to send push notifications on new chat messages

-- Function to notify new chat message via Edge Function
CREATE OR REPLACE FUNCTION notify_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id UUID;
  v_booking_record RECORD;
  v_sender_name TEXT;
  v_should_notify BOOLEAN;
BEGIN
  -- Get booking details
  SELECT b.*, p.full_name as sender_name
  INTO v_booking_record
  FROM bookings b
  JOIN profiles p ON p.id = NEW.sender_id
  WHERE b.id = NEW.booking_id;

  -- Determine recipient (the other participant)
  IF v_booking_record.customer_id = NEW.sender_id THEN
    v_recipient_id := v_booking_record.provider_id;
  ELSE
    v_recipient_id := v_booking_record.customer_id;
  END IF;

  -- Skip if no recipient (edge case: provider not yet assigned)
  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if recipient has chat notifications enabled and not in quiet hours
  SELECT
    COALESCE(np.chat_messages, true) AND NOT COALESCE(is_within_chat_quiet_hours(v_recipient_id), false)
  INTO v_should_notify
  FROM notification_preferences np
  WHERE np.user_id = v_recipient_id;

  -- Default to true if no preferences exist
  IF v_should_notify IS NULL THEN
    v_should_notify := true;
  END IF;

  -- Only send notification if allowed
  IF v_should_notify THEN
    -- Queue notification via pg_net to Edge Function
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/notify-chat-message',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'booking_id', NEW.booking_id,
        'sender_id', NEW.sender_id,
        'sender_name', v_booking_record.sender_name,
        'recipient_id', v_recipient_id,
        'message_type', NEW.message_type,
        'content', CASE
          WHEN NEW.message_type = 'IMAGE' THEN 'Sent an image'
          ELSE LEFT(NEW.content, 100)
        END
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Chat notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on booking_chats INSERT
DROP TRIGGER IF EXISTS on_chat_message_insert ON booking_chats;
CREATE TRIGGER on_chat_message_insert
AFTER INSERT ON booking_chats
FOR EACH ROW
EXECUTE FUNCTION notify_new_chat_message();

COMMENT ON FUNCTION notify_new_chat_message()
  IS 'Triggers push notification Edge Function when a new chat message is inserted';

COMMENT ON TRIGGER on_chat_message_insert ON booking_chats
  IS 'Sends push notification to recipient when a new chat message is created';
