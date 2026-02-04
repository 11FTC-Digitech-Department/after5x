-- Migration: Add chat helper functions
-- Purpose: SQL functions for unread counts and conversation listing

-- Function to get unread count for a user in a specific booking
CREATE OR REPLACE FUNCTION get_chat_unread_count(p_booking_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM booking_chats
  WHERE booking_id = p_booking_id
    AND sender_id != p_user_id
    AND read_at IS NULL;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to get all conversations with metadata for a user
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  booking_id UUID,
  booking_status TEXT,
  service_name TEXT,
  other_participant_id UUID,
  other_participant_name TEXT,
  other_participant_avatar TEXT,
  last_message_content TEXT,
  last_message_type TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER
) AS $$
  WITH booking_conversations AS (
    -- Get all bookings where user is participant and has chat messages
    SELECT DISTINCT ON (b.id)
           b.id as booking_id,
           b.status::TEXT as booking_status,
           COALESCE(
             (SELECT sv.name
              FROM booking_items bi
              JOIN service_variants sv ON sv.id = bi.service_variant_id
              WHERE bi.booking_id = b.id
              LIMIT 1),
             'Service'
           ) as service_name,
           CASE
             WHEN b.customer_id = p_user_id THEN b.provider_id
             ELSE b.customer_id
           END as other_id
    FROM bookings b
    WHERE (b.customer_id = p_user_id OR b.provider_id = p_user_id)
      AND b.status IN ('confirmed', 'on_the_way', 'arrived', 'in_progress', 'payment_pending')
      AND EXISTS (SELECT 1 FROM booking_chats bc WHERE bc.booking_id = b.id)
  ),
  last_messages AS (
    -- Get last message for each booking
    SELECT DISTINCT ON (booking_id)
           booking_id,
           content,
           message_type::TEXT,
           created_at
    FROM booking_chats
    WHERE booking_id IN (SELECT booking_id FROM booking_conversations)
    ORDER BY booking_id, created_at DESC
  ),
  unread_counts AS (
    -- Count unread messages per booking
    SELECT booking_id, COUNT(*)::INTEGER as unread
    FROM booking_chats
    WHERE booking_id IN (SELECT booking_id FROM booking_conversations)
      AND sender_id != p_user_id
      AND read_at IS NULL
    GROUP BY booking_id
  )
  SELECT
    bc.booking_id,
    bc.booking_status,
    bc.service_name,
    bc.other_id as other_participant_id,
    p.full_name as other_participant_name,
    p.avatar_url as other_participant_avatar,
    lm.content as last_message_content,
    lm.message_type as last_message_type,
    lm.created_at as last_message_at,
    COALESCE(uc.unread, 0) as unread_count
  FROM booking_conversations bc
  JOIN profiles p ON p.id = bc.other_id
  LEFT JOIN last_messages lm ON lm.booking_id = bc.booking_id
  LEFT JOIN unread_counts uc ON uc.booking_id = bc.booking_id
  ORDER BY lm.created_at DESC NULLS LAST;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_chat_unread_count(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO authenticated;

COMMENT ON FUNCTION get_chat_unread_count IS 'Returns the count of unread chat messages for a user in a specific booking';
COMMENT ON FUNCTION get_user_conversations IS 'Returns all active chat conversations for a user with metadata';
