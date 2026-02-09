import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonAvatar, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkDone, checkmark, image } from 'ionicons/icons';
import { ChatMessage } from '../../../core/models/chat.model';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, IonAvatar, IonIcon],
  templateUrl: './chat-bubble.component.html',
  styleUrls: ['./chat-bubble.component.scss']
})
export class ChatBubbleComponent {
  @Input() message!: ChatMessage;
  @Input() isOwn: boolean = false;
  @Input() showAvatar: boolean = true;
  @Input() showTimestamp: boolean = true;

  constructor() {
    addIcons({ checkmarkDone, checkmark, image });
  }

  get formattedTime(): string {
    if (!this.message?.created_at) return '';
    const date = new Date(this.message.created_at);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  get isImage(): boolean {
    return this.message?.message_type === 'IMAGE';
  }

  get isRead(): boolean {
    return !!this.message?.read_at;
  }

  get senderInitial(): string {
    return this.message?.sender?.full_name?.charAt(0)?.toUpperCase() || '?';
  }
}
