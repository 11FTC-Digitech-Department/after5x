import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
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
import { Conversation } from '../../../../core/models/chat.model';
import { ConversationItemComponent } from '../../../../shared/components/conversation-item/conversation-item.component';

@Component({
  selector: 'app-provider-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    // Cleanup if needed
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
      this.dataLoaded.set(true);
    } catch (err) {
      console.error('[ProviderMessagesPage] Error loading conversations:', err);
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
}
