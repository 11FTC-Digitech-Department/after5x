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
import { ActivatedRoute } from '@angular/router';
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
  NavController
} from '@ionic/angular/standalone';
import { ChatService } from '../../../../core/services/chat.service';
import { SessionService } from '../../../../core/auth/session';
import { ChatMessage, ChatParticipant, TypingEvent } from '../../../../core/models/chat.model';
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
    ChatBubbleComponent,
    ChatInputComponent,
    TypingIndicatorComponent
  ]
})
export class ChatRoomPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageList') messageList!: ElementRef;

  private route = inject(ActivatedRoute);
  private navController = inject(NavController);
  private chatService = inject(ChatService);
  private sessionService = inject(SessionService);

  bookingId: string = '';
  messages = signal<ChatMessage[]>([]);
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

  private currentUserId: string | null = null;
  private unsubscribeChat: (() => void) | null = null;

  constructor() {
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
    if (this.unsubscribeChat) {
      this.unsubscribeChat();
    }
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
      this.messages.set(messages);

      // Mark messages as read
      await this.chatService.markAsRead(this.bookingId);

      // Setup real-time subscription
      this.setupRealTimeSubscription();

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
        const currentMessages = this.messages();
        if (!currentMessages.find(m => m.id === message.id)) {
          this.messages.set([...currentMessages, message]);

          // Mark as read if from other user
          if (message.sender_id !== this.currentUserId) {
            this.chatService.markAsRead(this.bookingId);
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
      }
    });
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
        const currentMessages = this.messages();
        if (!currentMessages.find(m => m.id === sentMessage!.id)) {
          this.messages.set([...currentMessages, sentMessage]);
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
    // Show avatar for first message or if previous message is from different sender
    if (index === 0) return true;
    const previousMessage = this.messages()[index - 1];
    return previousMessage?.sender_id !== message.sender_id;
  }

  goBack(): void {
    this.navController.back();
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
