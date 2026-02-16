-- Add SYSTEM to chat_message_type enum
ALTER TYPE chat_message_type ADD VALUE IF NOT EXISTS 'SYSTEM';

-- Create system user in auth.users first (FK requirement), then profile
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'system@after5.app',
  '',
  now(),
  now(),
  now(),
  '',
  '{"provider":"system","providers":["system"]}',
  '{"full_name":"After5"}',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, avatar_url, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@after5.app', 'After5', null, 'admin')
ON CONFLICT (id) DO NOTHING;

-- SECURITY DEFINER function to insert system chat messages (bypasses RLS)
CREATE OR REPLACE FUNCTION insert_system_chat_message(
  p_booking_id UUID,
  p_content TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO booking_chats (booking_id, sender_id, message_type, content)
  VALUES (p_booking_id, '00000000-0000-0000-0000-000000000000', 'SYSTEM', p_content);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: insert a system chat message on booking status change
CREATE OR REPLACE FUNCTION send_booking_status_message()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_name TEXT;
  v_service_name TEXT;
  v_address TEXT;
  v_grand_total NUMERIC;
  v_message TEXT;
  v_scheduled_for TEXT;
BEGIN
  -- Only fire on actual status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Gather booking context
  SELECT p.full_name INTO v_provider_name
  FROM providers pr JOIN profiles p ON p.id = pr.id
  WHERE pr.id = NEW.provider_id;

  SELECT sv.name INTO v_service_name
  FROM booking_items bi JOIN service_variants sv ON sv.id = bi.service_variant_id
  WHERE bi.booking_id = NEW.id LIMIT 1;

  v_address := NEW.address_snapshot->>'address';
  v_grand_total := NEW.grand_total;
  v_scheduled_for := to_char(NEW.scheduled_for, 'Mon DD, YYYY at HH12:MI AM');

  -- Build message based on new status
  v_message := CASE NEW.status
    WHEN 'pending_acceptance' THEN
      format('We found a match! %s has been assigned to your %s booking and is reviewing your request.',
        COALESCE(v_provider_name, 'A provider'), COALESCE(v_service_name, 'service'))

    WHEN 'confirmed' THEN
      format('%s has confirmed your booking for %s scheduled on %s. You can now chat directly with your expert here.',
        COALESCE(v_provider_name, 'Your provider'), COALESCE(v_service_name, 'your service'), COALESCE(v_scheduled_for, 'the scheduled date'))

    WHEN 'on_the_way' THEN
      format('%s is on the way to %s. Please make sure someone is available at the location to meet them.',
        COALESCE(v_provider_name, 'Your provider'), COALESCE(v_address, 'your location'))

    WHEN 'arrived' THEN
      format('%s has arrived at your location and is ready to begin. Please meet them to get started.',
        COALESCE(v_provider_name, 'Your provider'))

    WHEN 'in_progress' THEN
      format('%s has started working on your %s service. The work is now in progress.',
        COALESCE(v_provider_name, 'Your provider'), COALESCE(v_service_name, 'service'))

    WHEN 'payment_pending' THEN
      format('The service has been completed! Your total is Rp %s. Please complete your payment to finalize the booking.',
        COALESCE(to_char(v_grand_total, 'FM999,999,999'), '0'))

    WHEN 'paid' THEN
      'Payment received! Thank you for your payment. Your booking is now complete.'

    WHEN 'completed' THEN
      format('Your %s service has been completed successfully. Thank you for choosing After5! We''d love to hear your feedback.',
        COALESCE(v_service_name, 'service'))

    WHEN 'cancelled' THEN
      format('Your %s booking has been cancelled.%s',
        COALESCE(v_service_name, 'service'),
        CASE WHEN NEW.cancellation_reason IS NOT NULL THEN ' Reason: ' || NEW.cancellation_reason ELSE '' END)

    WHEN 'rejected' THEN
      format('Unfortunately, %s was unable to accept your booking for %s. We''re looking for another available expert.',
        COALESCE(v_provider_name, 'the provider'), COALESCE(v_service_name, 'your service'))

    ELSE NULL
  END;

  -- Insert system message if we have one
  IF v_message IS NOT NULL THEN
    PERFORM insert_system_chat_message(NEW.id, v_message);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on booking status changes
DROP TRIGGER IF EXISTS on_booking_status_change_message ON bookings;
CREATE TRIGGER on_booking_status_change_message
AFTER UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION send_booking_status_message();

-- Update chat notification trigger to skip SYSTEM messages (prevent double notifications)
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
  -- Skip SYSTEM messages — status notifications are sent separately
  IF NEW.message_type = 'SYSTEM' THEN
    RETURN NEW;
  END IF;

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
