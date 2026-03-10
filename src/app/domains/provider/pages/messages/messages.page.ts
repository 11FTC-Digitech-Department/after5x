import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { ChatService } from '../../../../core/services/chat.service';
import { SessionService } from '../../../../core/auth/session';
import { Conversation, ChatMessageType } from '../../../../core/models/chat.model';
import { ConversationItemComponent } from '../../../../shared/components/conversation-item/conversation-item.component';

@Component({
  selector: 'app-provider-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonSpinner,
    IonText,
    ConversationItemComponent
  ]
})
export class ProviderMessagesPage implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  conversations = signal<Conversation[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  private dataLoaded = signal<boolean>(false);
  private unsubscribeRealtime: (() => void) | null = null;

  constructor() {
    // Load data when profile becomes available
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (profile?.id && !isLoading && !this.dataLoaded()) {
        this.loadConversations();
      }
    });
  }

  ngOnInit(): void {
    // Fast path: if profile already loaded
    const profile = this.sessionService.profile();
    if (profile?.id && !this.dataLoaded()) {
      this.loadConversations();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeRealtime?.();
  }

  ionViewWillEnter(): void {
    // Refresh on returning to this page
    if (this.dataLoaded()) {
      this.loadConversations(true);
    }
  }

  async loadConversations(silent: boolean = false): Promise<void> {
    try {
      if (!silent) {
        this.loading.set(true);
      }
      this.error.set(null);

      const conversations = await this.chatService.getConversations();
      this.conversations.set(conversations);
      if (!this.dataLoaded()) {
        this.dataLoaded.set(true);
        this.setupRealtimeSubscription();
      }
    } catch (err) {
      devError('[ProviderMessagesPage] Error loading conversations:', err);
      this.error.set('Failed to load conversations');
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: any): Promise<void> {
    await this.loadConversations(true);
    event.target.complete();
  }

  onConversationClick(conversation: Conversation): void {
    this.router.navigate(['/p/chat', conversation.booking_id]);
  }

  get isEmpty(): boolean {
    return !this.loading() && this.conversations().length === 0;
  }

  private setupRealtimeSubscription(): void {
    this.unsubscribeRealtime = this.chatService.subscribeToConversationUpdates(
      (bookingId: string, message: any) => {
        this.handleNewMessage(bookingId, message);
      }
    );
  }

  private handleNewMessage(bookingId: string, message: any): void {
    const currentConversations = this.conversations();
    const index = currentConversations.findIndex(c => c.booking_id === bookingId);

    if (index >= 0) {
      const updated = [...currentConversations];
      const conv = { ...updated[index] };
      const userId = this.sessionService.profile()?.id;

      conv.last_message = {
        id: message.id,
        booking_id: message.booking_id,
        sender_id: message.sender_id,
        message_type: (message.message_type || 'TEXT') as ChatMessageType,
        content: message.content,
        read_at: null,
        is_archived: false,
        created_at: message.created_at || new Date().toISOString()
      };
      conv.updated_at = message.created_at || new Date().toISOString();

      if (message.sender_id !== userId) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }

      updated.splice(index, 1);
      updated.unshift(conv);
      this.conversations.set(updated);

      this.chatService.refreshTotalUnreadCount();
    } else {
      this.loadConversations(true);
    }
  }
}
