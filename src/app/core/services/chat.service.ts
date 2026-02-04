import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { SessionService } from '../auth/session';
import { RealTimeService } from './real-time.service';
import {
  ChatMessage,
  ChatMessageType,
  Conversation,
  ConversationRow,
  SendMessagePayload,
  TypingEvent,
  ChatSubscriptionCallbacks,
  ChatParticipant
} from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private realTimeService = inject(RealTimeService);

  // Total unread count signal for badges
  private _totalUnreadCount = signal<number>(0);
  readonly totalUnreadCount = this._totalUnreadCount.asReadonly();

  // Active chat subscriptions
  private chatSubscriptions = new Map<string, () => void>();

  // Typing state management
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly TYPING_TIMEOUT_MS = 3000;

  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<Conversation[]> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) {
      console.error('[ChatService] No user ID available');
      return [];
    }

    try {
      const { data, error } = await (this.supabaseService.client.rpc as any)(
        'get_user_conversations',
        { p_user_id: userId }
      );

      if (error) {
        console.error('[ChatService] Error fetching conversations:', error);
        return [];
      }

      const conversations = ((data || []) as ConversationRow[]).map(row => this.mapRowToConversation(row));

      // Update total unread count
      const totalUnread = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
      this._totalUnreadCount.set(totalUnread);

      return conversations;
    } catch (error) {
      console.error('[ChatService] Error fetching conversations:', error);
      return [];
    }
  }

  /**
   * Get messages for a specific booking
   */
  async getMessages(bookingId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('booking_chats')
        .select(`
          *,
          sender:profiles!sender_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('booking_id', bookingId)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ChatService] Error fetching messages:', error);
        return [];
      }

      return (data || []).map(msg => ({
        id: msg.id,
        booking_id: msg.booking_id,
        sender_id: msg.sender_id,
        sender: msg.sender as ChatParticipant,
        message_type: msg.message_type as ChatMessageType,
        content: msg.content,
        read_at: msg.read_at,
        is_archived: msg.is_archived ?? false,
        created_at: msg.created_at ?? ''
      }));
    } catch (error) {
      console.error('[ChatService] Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(
    bookingId: string,
    content: string,
    messageType: ChatMessageType = 'TEXT'
  ): Promise<ChatMessage | null> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) {
      console.error('[ChatService] No user ID available');
      return null;
    }

    try {
      const payload: SendMessagePayload = {
        booking_id: bookingId,
        sender_id: userId,
        message_type: messageType,
        content: content.trim()
      };

      const { data, error } = await this.supabaseService.client
        .from('booking_chats')
        .insert(payload)
        .select(`
          *,
          sender:profiles!sender_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) {
        console.error('[ChatService] Error sending message:', error);
        return null;
      }

      return {
        id: data.id,
        booking_id: data.booking_id,
        sender_id: data.sender_id,
        sender: data.sender as ChatParticipant,
        message_type: data.message_type as ChatMessageType,
        content: data.content,
        read_at: data.read_at,
        is_archived: data.is_archived ?? false,
        created_at: data.created_at ?? ''
      };
    } catch (error) {
      console.error('[ChatService] Error sending message:', error);
      return null;
    }
  }

  /**
   * Upload and send an image message
   */
  async sendImage(bookingId: string, file: File): Promise<ChatMessage | null> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) {
      console.error('[ChatService] No user ID available');
      return null;
    }

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/${bookingId}/${timestamp}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await this.supabaseService.client
        .storage
        .from('chat-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('[ChatService] Error uploading image:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = this.supabaseService.client
        .storage
        .from('chat-images')
        .getPublicUrl(uploadData.path);

      // Send message with image URL
      return this.sendMessage(bookingId, urlData.publicUrl, 'IMAGE');
    } catch (error) {
      console.error('[ChatService] Error sending image:', error);
      return null;
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markAsRead(bookingId: string): Promise<void> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) return;

    try {
      const { error } = await this.supabaseService.client
        .from('booking_chats')
        .update({ read_at: new Date().toISOString() })
        .eq('booking_id', bookingId)
        .neq('sender_id', userId)
        .is('read_at', null);

      if (error) {
        console.error('[ChatService] Error marking messages as read:', error);
      }

      // Refresh total unread count
      await this.refreshTotalUnreadCount();
    } catch (error) {
      console.error('[ChatService] Error marking messages as read:', error);
    }
  }

  /**
   * Get unread count for a specific booking
   */
  async getUnreadCount(bookingId: string): Promise<number> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) return 0;

    try {
      const { data, error } = await (this.supabaseService.client.rpc as any)(
        'get_chat_unread_count',
        {
          p_booking_id: bookingId,
          p_user_id: userId
        }
      );

      if (error) {
        console.error('[ChatService] Error getting unread count:', error);
        return 0;
      }

      return (data as number) || 0;
    } catch (error) {
      console.error('[ChatService] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Refresh total unread count across all conversations
   */
  async refreshTotalUnreadCount(): Promise<number> {
    const conversations = await this.getConversations();
    const total = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
    this._totalUnreadCount.set(total);
    return total;
  }

  /**
   * Subscribe to real-time chat updates for a booking
   */
  subscribeToChat(
    bookingId: string,
    callbacks: ChatSubscriptionCallbacks
  ): () => void {
    // Unsubscribe from any existing subscription for this booking
    this.unsubscribeFromChat(bookingId);

    const unsubscribe = this.realTimeService.subscribeToChat(
      bookingId,
      (message: any) => {
        // Fetch sender info and call callback
        this.enrichMessageWithSender(message).then(enrichedMessage => {
          callbacks.onMessage(enrichedMessage);
        });
      },
      callbacks.onTyping ? (typingData: any) => {
        // Handle typing event - normalize field names from broadcast
        const normalizedData = {
          user_id: typingData.user_id || typingData.userId,
          user_name: typingData.user_name || typingData.userName,
          is_typing: typingData.is_typing ?? typingData.isTyping ?? false
        };
        this.handleTypingEvent(bookingId, normalizedData, callbacks.onTyping!);
      } : undefined
    );

    this.chatSubscriptions.set(bookingId, unsubscribe);

    return () => this.unsubscribeFromChat(bookingId);
  }

  /**
   * Unsubscribe from chat updates for a booking
   */
  unsubscribeFromChat(bookingId: string): void {
    const unsubscribe = this.chatSubscriptions.get(bookingId);
    if (unsubscribe) {
      unsubscribe();
      this.chatSubscriptions.delete(bookingId);
    }
  }

  /**
   * Broadcast typing indicator
   */
  async broadcastTyping(bookingId: string, isTyping: boolean): Promise<void> {
    const profile = this.sessionService.profile();
    if (!profile) return;

    const channelName = `booking-chat-${bookingId}`;
    const channel = this.supabaseService.client.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: profile.id,
        user_name: profile.full_name || 'User',
        is_typing: isTyping,
        timestamp: Date.now()
      } as TypingEvent
    });
  }

  /**
   * Unsubscribe from all active chat subscriptions
   */
  unsubscribeAll(): void {
    for (const [bookingId, unsubscribe] of this.chatSubscriptions) {
      unsubscribe();
    }
    this.chatSubscriptions.clear();

    // Clear typing timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();
  }

  /**
   * Check if a booking has an active chat (is in allowed status)
   */
  async canChat(bookingId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseService.client
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();

      if (error || !data || !data.status) return false;

      const allowedStatuses = [
        'confirmed',
        'on_the_way',
        'arrived',
        'in_progress',
        'payment_pending'
      ];

      return allowedStatuses.includes(data.status as string);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get booking details for chat header
   */
  async getChatContext(bookingId: string): Promise<{
    serviceName: string;
    otherParticipant: ChatParticipant;
    bookingStatus: string;
  } | null> {
    const userId = this.sessionService.profile()?.id;
    if (!userId) return null;

    try {
      const { data, error } = await this.supabaseService.client
        .from('bookings')
        .select(`
          id,
          status,
          customer_id,
          provider_id,
          customer:customers!customer_id (
            id,
            profiles!inner (
              id,
              full_name,
              avatar_url
            )
          ),
          provider:providers!provider_id (
            id,
            profiles!inner (
              id,
              full_name,
              avatar_url
            )
          ),
          booking_items (
            service_variant:service_variants (
              name
            )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (error || !data) return null;

      // Determine other participant
      const isCustomer = data.customer_id === userId;
      const otherProfile = isCustomer
        ? (data.provider as any)?.profiles
        : (data.customer as any)?.profiles;

      if (!otherProfile) return null;

      const serviceName = (data.booking_items as any[])?.[0]?.service_variant?.name || 'Service';

      return {
        serviceName,
        bookingStatus: data.status ?? '',
        otherParticipant: {
          id: otherProfile.id,
          full_name: otherProfile.full_name,
          avatar_url: otherProfile.avatar_url
        }
      };
    } catch (error) {
      console.error('[ChatService] Error getting chat context:', error);
      return null;
    }
  }

  // Private helper methods

  private mapRowToConversation(row: ConversationRow): Conversation {
    return {
      booking_id: row.booking_id,
      booking_status: row.booking_status,
      service_name: row.service_name,
      other_participant: {
        id: row.other_participant_id,
        full_name: row.other_participant_name,
        avatar_url: row.other_participant_avatar
      },
      last_message: row.last_message_content ? {
        id: '',
        booking_id: row.booking_id,
        sender_id: '',
        message_type: (row.last_message_type || 'TEXT') as ChatMessageType,
        content: row.last_message_content,
        read_at: null,
        is_archived: false,
        created_at: row.last_message_at ?? ''
      } : null,
      unread_count: row.unread_count ?? 0,
      updated_at: row.last_message_at ?? ''
    };
  }

  private async enrichMessageWithSender(message: any): Promise<ChatMessage> {
    // If sender info is already included, use it
    if (message.sender) {
      return {
        id: message.id,
        booking_id: message.booking_id,
        sender_id: message.sender_id,
        sender: message.sender,
        message_type: message.message_type as ChatMessageType,
        content: message.content,
        read_at: message.read_at,
        is_archived: message.is_archived ?? false,
        created_at: message.created_at ?? ''
      };
    }

    // Fetch sender info
    try {
      const { data } = await this.supabaseService.client
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', message.sender_id)
        .single();

      return {
        id: message.id,
        booking_id: message.booking_id,
        sender_id: message.sender_id,
        sender: data as ChatParticipant,
        message_type: message.message_type as ChatMessageType,
        content: message.content,
        read_at: message.read_at,
        is_archived: message.is_archived ?? false,
        created_at: message.created_at ?? ''
      };
    } catch {
      return {
        id: message.id,
        booking_id: message.booking_id,
        sender_id: message.sender_id,
        message_type: message.message_type as ChatMessageType,
        content: message.content,
        read_at: message.read_at,
        is_archived: message.is_archived ?? false,
        created_at: message.created_at ?? ''
      };
    }
  }

  private handleTypingEvent(
    bookingId: string,
    typingData: { user_id: string; user_name?: string; is_typing: boolean },
    callback: (event: TypingEvent) => void
  ): void {
    const currentUserId = this.sessionService.profile()?.id;

    // Don't show typing indicator for own typing
    if (typingData.user_id === currentUserId) return;

    const key = `${bookingId}-${typingData.user_id}`;

    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeouts.delete(key);
    }

    if (typingData.is_typing) {
      // Set timeout to auto-clear typing indicator
      const timeout = setTimeout(() => {
        callback({
          user_id: typingData.user_id,
          user_name: '',
          is_typing: false,
          timestamp: Date.now()
        });
        this.typingTimeouts.delete(key);
      }, this.TYPING_TIMEOUT_MS);

      this.typingTimeouts.set(key, timeout);
    }

    callback({
      user_id: typingData.user_id,
      user_name: typingData.user_name || '',
      is_typing: typingData.is_typing,
      timestamp: Date.now()
    });
  }
}
