-- Migration: Add chat notification preferences
-- Purpose: Allow users to configure chat notification settings including quiet hours

-- Add chat notification preference columns
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS chat_messages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS chat_quiet_hours_start TIME,
ADD COLUMN IF NOT EXISTS chat_quiet_hours_end TIME;

-- Add comments for documentation
COMMENT ON COLUMN notification_preferences.chat_messages
  IS 'Enable/disable push notifications for chat messages';

COMMENT ON COLUMN notification_preferences.chat_quiet_hours_start
  IS 'Start time for chat quiet hours (no notifications). Format: HH:MM:SS';

COMMENT ON COLUMN notification_preferences.chat_quiet_hours_end
  IS 'End time for chat quiet hours (no notifications). Format: HH:MM:SS';

-- Create helper function to check if current time is within quiet hours
CREATE OR REPLACE FUNCTION is_within_chat_quiet_hours(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_start TIME;
  v_end TIME;
  v_current TIME;
BEGIN
  -- Get user's quiet hours settings
  SELECT chat_quiet_hours_start, chat_quiet_hours_end
  INTO v_start, v_end
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- If no quiet hours set, not in quiet period
  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get current time in user's timezone (defaulting to UTC)
  v_current := CURRENT_TIME;

  -- Handle overnight quiet hours (e.g., 22:00 - 06:00)
  IF v_start > v_end THEN
    RETURN v_current >= v_start OR v_current <= v_end;
  ELSE
    RETURN v_current >= v_start AND v_current <= v_end;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_within_chat_quiet_hours(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_within_chat_quiet_hours(UUID) TO service_role;

COMMENT ON FUNCTION is_within_chat_quiet_hours
  IS 'Checks if the current time falls within a user''s configured chat quiet hours';
