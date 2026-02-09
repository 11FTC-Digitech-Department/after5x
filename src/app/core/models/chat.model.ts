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
 * System event displayed inline in the chat flow (e.g., status changes)
 */
export interface ChatSystemEvent {
  id: string;
  type: 'status_change';
  status: string;
  label: string;
  icon: string;
  color: string;
  created_at: string;
}

/**
 * Union type for items displayed in the chat timeline
 */
export type ChatItem = ChatMessage | ChatSystemEvent;

/**
 * Type guard to check if a chat item is a system event
 */
export function isSystemEvent(item: ChatItem): item is ChatSystemEvent {
  return 'type' in item && (item as ChatSystemEvent).type === 'status_change';
}

/**
 * Presence state for online indicator
 */
export interface ChatPresenceState {
  userId: string;
  userName: string;
  onlineAt: string;
}

/**
 * Real-time chat subscription callbacks
 */
export interface ChatSubscriptionCallbacks {
  onMessage: (message: ChatMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (onlineUsers: ChatPresenceState[]) => void;
  onError?: (error: Error) => void;
}
