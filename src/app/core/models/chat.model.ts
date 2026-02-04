/**
 * Chat Models for After5 messaging system
 * Supports real-time chat between customers and providers within active bookings
 */

export type ChatMessageType = 'TEXT' | 'IMAGE';

/**
 * Profile summary for chat participants
 */
export interface ChatParticipant {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/**
 * Individual chat message
 */
export interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  sender?: ChatParticipant;
  message_type: ChatMessageType;
  content: string;
  read_at: string | null;
  is_archived: boolean;
  created_at: string;
}

/**
 * Conversation summary for the messages list
 */
export interface Conversation {
  booking_id: string;
  booking_status: string;
  service_name: string;
  other_participant: ChatParticipant;
  last_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
}

/**
 * Response from get_user_conversations SQL function
 */
export interface ConversationRow {
  booking_id: string;
  booking_status: string;
  service_name: string;
  other_participant_id: string;
  other_participant_name: string;
  other_participant_avatar: string | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  unread_count: number;
}

/**
 * Payload for sending a new message
 */
export interface SendMessagePayload {
  booking_id: string;
  sender_id: string;
  message_type: ChatMessageType;
  content: string;
}

/**
 * Typing indicator event data
 */
export interface TypingEvent {
  user_id: string;
  user_name: string;
  is_typing: boolean;
  timestamp: number;
}

/**
 * Chat notification preferences
 */
export interface ChatNotificationPreferences {
  chat_messages: boolean;
  chat_quiet_hours_start: string | null; // TIME format HH:MM:SS
  chat_quiet_hours_end: string | null;
}

/**
 * Real-time chat subscription callbacks
 */
export interface ChatSubscriptionCallbacks {
  onMessage: (message: ChatMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onError?: (error: Error) => void;
}
