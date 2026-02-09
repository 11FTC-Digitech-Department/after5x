import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonItem, IonAvatar, IonLabel, IonBadge, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { image } from 'ionicons/icons';
import { Conversation } from '../../../core/models/chat.model';

@Component({
  selector: 'app-conversation-item',
  standalone: true,
  imports: [CommonModule, IonItem, IonAvatar, IonLabel, IonBadge, IonIcon],
  templateUrl: './conversation-item.component.html',
  styleUrls: ['./conversation-item.component.scss']
})
export class ConversationItemComponent {
  @Input() conversation!: Conversation;

  @Output() conversationClick = new EventEmitter<Conversation>();

  constructor() {
    addIcons({ image });
  }

  get participantInitial(): string {
    return this.conversation?.other_participant?.full_name?.charAt(0)?.toUpperCase() || '?';
  }

  get lastMessagePreview(): string {
    const lastMessage = this.conversation?.last_message;
    if (!lastMessage) return 'No messages yet';

    if (lastMessage.message_type === 'IMAGE') {
      return 'Sent an image';
    }

    // Truncate long messages
    const content = lastMessage.content || '';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  get formattedTime(): string {
    if (!this.conversation?.updated_at) return '';

    const date = new Date(this.conversation.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week - show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  get hasUnread(): boolean {
    return (this.conversation?.unread_count || 0) > 0;
  }

  get shortBookingId(): string {
    const id = this.conversation?.booking_id;
    return id ? `#${id.slice(-6).toUpperCase()}` : '';
  }

  get statusColor(): string {
    const status = this.conversation?.booking_status;
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

  onClick(): void {
    this.conversationClick.emit(this.conversation);
  }
}
