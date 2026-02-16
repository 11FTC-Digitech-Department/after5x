import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonText,
  IonBadge,
  IonIcon,
  IonButton,
  NavController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  lockClosedOutline,
  documentTextOutline,
  hourglass,
  checkmarkCircle,
  car,
  locationOutline,
  hammer,
  alertCircle,
  closeCircle,
  callOutline
} from 'ionicons/icons';
import { ChatService } from '../../../../core/services/chat.service';
import { ChatNotificationService } from '../../../../core/services/chat-notification.service';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { SessionService } from '../../../../core/auth/session';
import {
  ChatMessage,
  ChatParticipant,
  ChatItem,
  ChatSystemEvent,
  ChatPresenceState,
  TypingEvent,
  isSystemEvent
} from '../../../../core/models/chat.model';
import { isToday, isYesterday, format } from 'date-fns';

// Status display configuration for inline banners
const STATUS_BANNER_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  finding_provider: { label: 'Finding a provider...', icon: 'hourglass', color: 'warning' },
  pending_acceptance: { label: 'Waiting for provider to accept', icon: 'hourglass', color: 'warning' },
  confirmed: { label: 'Booking confirmed', icon: 'checkmark-circle', color: 'primary' },
  on_the_way: { label: 'Provider is on the way', icon: 'car', color: 'tertiary' },
  arrived: { label: 'Provider has arrived', icon: 'location-outline', color: 'tertiary' },
  in_progress: { label: 'Service in progress', icon: 'hammer', color: 'secondary' },
  payment_pending: { label: 'Payment required', icon: 'alert-circle', color: 'warning' },
  paid: { label: 'Payment received', icon: 'checkmark-circle', color: 'success' },
  completed: { label: 'Service completed', icon: 'checkmark-circle', color: 'success' },
  cancelled: { label: 'Booking cancelled', icon: 'close-circle', color: 'danger' },
  rejected: { label: 'Booking rejected', icon: 'close-circle', color: 'danger' },
  expired: { label: 'Booking expired', icon: 'close-circle', color: 'medium' },
};

import { ChatBubbleComponent } from '../../../../shared/components/chat-bubble/chat-bubble.component';
import { ChatInputComponent, ChatInputEvent } from '../../../../shared/components/chat-input/chat-input.component';
import { TypingIndicatorComponent } from '../../../../shared/components/typing-indicator/typing-indicator.component';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonText,
    IonBadge,
    IonIcon,
    IonButton,
    ChatBubbleComponent,
    ChatInputComponent,
    TypingIndicatorComponent
  ]
})
export class ChatRoomPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageList') messageList!: ElementRef;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private navController = inject(NavController);
  private chatService = inject(ChatService);
  private chatNotificationService = inject(ChatNotificationService);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);

  /** Back goes to messages list for the current app context (customer or provider). */
  get defaultBackHref(): string {
    return this.router.url.startsWith('/c/') ? '/c/messages' : '/p/messages';
  }

  bookingId: string = '';
  chatItems = signal<ChatItem[]>([]);
  loading = signal<boolean>(true);
  sending = signal<boolean>(false);
  error = signal<string | null>(null);
  canChat = signal<boolean>(true);

  // Chat context
  serviceName = signal<string>('');
  bookingStatus = signal<string>('');
  otherParticipant = signal<ChatParticipant | null>(null);

  // Typing indicator
  isOtherTyping = signal<boolean>(false);
  typingUserName = signal<string>('');

  // Online presence
  isOtherOnline = signal<boolean>(false);

  private currentUserId: string | null = null;
  private unsubscribeChat: (() => void) | null = null;
  private unsubscribeBooking: (() => void) | null = null;
  private previousBookingStatus: string | null = null;

  constructor() {
    addIcons({
      lockClosedOutline,
      documentTextOutline,
      hourglass,
      checkmarkCircle,
      car,
      locationOutline,
      hammer,
      alertCircle,
      closeCircle,
      callOutline
    });
    // React to profile changes
    effect(() => {
      const profile = this.sessionService.profile();
      if (profile?.id) {
        this.currentUserId = profile.id;
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.bookingId = this.route.snapshot.paramMap.get('bookingId') || '';

    if (!this.bookingId) {
      this.error.set('Invalid booking ID');
      this.loading.set(false);
      return;
    }

    // Get current user ID
    const profile = this.sessionService.profile();
    if (profile?.id) {
      this.currentUserId = profile.id;
    }

    await this.loadChatData();
  }

  ngOnDestroy(): void {
    this.unsubscribeChat?.();
    this.unsubscribeBooking?.();
  }

  ionViewWillEnter(): void {
    // Mark messages as read when entering chat
    if (this.bookingId) {
      this.chatService.markAsRead(this.bookingId);
    }
  }

  private async loadChatData(): Promise<void> {
    try {
      this.loading.set(true);
      this.error.set(null);

      // Check if chat is available
      const chatAllowed = await this.chatService.canChat(this.bookingId);
      this.canChat.set(chatAllowed);

      // Load chat context (header info)
      const context = await this.chatService.getChatContext(this.bookingId);
      if (context) {
        this.serviceName.set(context.serviceName);
        this.bookingStatus.set(context.bookingStatus);
        this.otherParticipant.set(context.otherParticipant);
      }

      // Load messages
      const messages = await this.chatService.getMessages(this.bookingId);
      this.chatItems.set(messages);

      // Track initial status for change detection
      this.previousBookingStatus = context?.bookingStatus || null;

      // Mark messages as read
      await this.chatService.markAsRead(this.bookingId);

      // Setup real-time subscriptions
      this.setupRealTimeSubscription();
      this.setupBookingStatusSubscription();

      // Scroll to bottom after messages load
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (err) {
      console.error('[ChatRoomPage] Error loading chat:', err);
      this.error.set('Failed to load chat');
    } finally {
      this.loading.set(false);
    }
  }

  private setupRealTimeSubscription(): void {
    this.unsubscribeChat = this.chatService.subscribeToChat(this.bookingId, {
      onMessage: (message: ChatMessage) => {
        // Add message to list if not already present
        const currentItems = this.chatItems();
        if (!currentItems.find(m => m.id === message.id)) {
          this.chatItems.set([...currentItems, message]);

          // Mark as read and notify if from other user (skip SYSTEM messages)
          if (message.sender_id !== this.currentUserId && message.message_type !== 'SYSTEM') {
            this.chatService.markAsRead(this.bookingId);
            this.chatNotificationService.notify();
          }

          // Scroll to bottom
          setTimeout(() => this.scrollToBottom(), 50);
        }
      },
      onTyping: (event: TypingEvent) => {
        this.isOtherTyping.set(event.is_typing);
        this.typingUserName.set(event.user_name || this.otherParticipant()?.full_name || 'User');

        // Auto-hide typing indicator after 3 seconds
        if (event.is_typing) {
          setTimeout(() => {
            this.isOtherTyping.set(false);
          }, 3000);
        }
      },
      onPresence: (onlineUsers: ChatPresenceState[]) => {
        const otherOnline = onlineUsers.some(u => u.userId !== this.currentUserId);
        this.isOtherOnline.set(otherOnline);
      }
    });

    // Track own presence on this chat channel
    this.chatService.trackPresence(this.bookingId);
  }

  private setupBookingStatusSubscription(): void {
    const client = this.supabaseService.client;
    const channelName = `chat-booking-status-${this.bookingId}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${this.bookingId}`
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus && newStatus !== this.previousBookingStatus) {
            this.onBookingStatusChange(newStatus);
            this.previousBookingStatus = newStatus;
          }
        }
      )
      .subscribe();

    this.unsubscribeBooking = () => {
      client.removeChannel(channel);
    };
  }

  private onBookingStatusChange(newStatus: string): void {
    const config = STATUS_BANNER_CONFIG[newStatus];
    if (!config) return;

    // Update header status
    this.bookingStatus.set(newStatus);

    // Insert system event into chat timeline
    const systemEvent: ChatSystemEvent = {
      id: `status-${newStatus}-${Date.now()}`,
      type: 'status_change',
      status: newStatus,
      label: config.label,
      icon: config.icon,
      color: config.color,
      created_at: new Date().toISOString()
    };

    this.chatItems.set([...this.chatItems(), systemEvent]);
    setTimeout(() => this.scrollToBottom(), 50);

    // Update canChat based on new status
    const chatAllowedStatuses = ['confirmed', 'on_the_way', 'arrived', 'in_progress', 'payment_pending'];
    this.canChat.set(chatAllowedStatuses.includes(newStatus));
  }

  async onSendMessage(event: ChatInputEvent): Promise<void> {
    if (!this.canChat()) {
      console.error('[ChatRoomPage] Chat not available');
      return;
    }

    try {
      this.sending.set(true);

      let sentMessage: ChatMessage | null = null;

      if (event.type === 'image' && event.file) {
        sentMessage = await this.chatService.sendImage(this.bookingId, event.file);
      } else if (event.type === 'text') {
        sentMessage = await this.chatService.sendMessage(this.bookingId, event.content);
      }

      if (sentMessage) {
        // Message will be added via real-time subscription
        // But add optimistically for better UX
        const currentItems = this.chatItems();
        if (!currentItems.find(m => m.id === sentMessage!.id)) {
          this.chatItems.set([...currentItems, sentMessage]);
        }
        setTimeout(() => this.scrollToBottom(), 50);
      }
    } catch (err) {
      console.error('[ChatRoomPage] Error sending message:', err);
    } finally {
      this.sending.set(false);
    }
  }

  onTypingChange(isTyping: boolean): void {
    this.chatService.broadcastTyping(this.bookingId, isTyping);
  }

  private scrollToBottom(): void {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  isOwnMessage(message: ChatMessage): boolean {
    return message.sender_id === this.currentUserId;
  }

  shouldShowAvatar(message: ChatMessage, index: number): boolean {
    // No avatar for SYSTEM messages
    if (message.message_type === 'SYSTEM') return false;
    // Show avatar for first message or if previous message is from different sender
    if (index === 0) return true;
    const items = this.chatItems();
    const previousItem = items[index - 1];
    if (isSystemEvent(previousItem)) return true;
    // Treat SYSTEM chat messages like system events for avatar grouping
    if ('message_type' in previousItem && (previousItem as ChatMessage).message_type === 'SYSTEM') return true;
    return previousItem?.sender_id !== message.sender_id;
  }

  /** Type guard exposed for the template */
  isSystemEvent = isSystemEvent;

  // Date separator logic
  shouldShowDateSeparator(item: ChatItem, index: number): boolean {
    if (isSystemEvent(item)) return false;
    if (index === 0) return true;

    const currentDate = new Date(item.created_at).toDateString();
    // Look back for the previous non-system-event item
    const items = this.chatItems();
    for (let i = index - 1; i >= 0; i--) {
      const prevItem = items[i];
      const prevDate = new Date(prevItem.created_at).toDateString();
      return currentDate !== prevDate;
    }
    return true;
  }

  getDateLabel(item: ChatItem): string {
    const date = new Date(item.created_at);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  }

  // Smart timestamp logic — only show on last message of a sender group or after a time gap
  shouldShowTimestamp(item: ChatItem, index: number): boolean {
    if (isSystemEvent(item)) return false;
    const items = this.chatItems();

    // Always show on last item
    if (index === items.length - 1) return true;

    const nextItem = items[index + 1];

    // Show if next item is a system event
    if (isSystemEvent(nextItem)) return true;

    // Show if next message is from a different sender
    if ((nextItem as ChatMessage).sender_id !== (item as ChatMessage).sender_id) return true;

    // Show if time gap > 5 minutes
    const currentTime = new Date(item.created_at).getTime();
    const nextTime = new Date(nextItem.created_at).getTime();
    if (nextTime - currentTime > 5 * 60 * 1000) return true;

    return false;
  }

  goBack(): void {
    this.navController.back();
  }

  callOtherParticipant(): void {
    const phone = this.otherParticipant()?.phone_number;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  goToBookingDetails(): void {
    if (!this.bookingId) return;
    const isCustomer = this.router.url.startsWith('/c/');
    const route = isCustomer ? `/c/bookings/${this.bookingId}` : `/p/job/${this.bookingId}`;
    this.router.navigateByUrl(route);
  }

  get participantInitial(): string {
    return this.otherParticipant()?.full_name?.charAt(0)?.toUpperCase() || '?';
  }

  get statusColor(): string {
    const status = this.bookingStatus();
    switch (status) {
      case 'confirmed':
        return 'primary';
      case 'on_the_way':
      case 'arrived':
        return 'tertiary';
      case 'in_progress':
        return 'secondary';
      case 'payment_pending':
        return 'warning';
      default:
        return 'medium';
    }
  }

  get formattedStatus(): string {
    const status = this.bookingStatus();
    return status.replace(/_/g, ' ');
  }
}
