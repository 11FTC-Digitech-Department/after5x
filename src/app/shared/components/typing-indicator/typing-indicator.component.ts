import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-typing-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="typing-indicator" [class.visible]="visible">
      @if (userName) {
        <span class="typing-text">{{ userName }} is typing</span>
      }
      <div class="dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
  `,
  styles: [`
    .typing-indicator {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;

      &.visible {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .typing-text {
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-right: 8px;
    }

    .dots {
      display: flex;
      gap: 4px;
    }

    .dot {
      width: 6px;
      height: 6px;
      background: var(--ion-color-medium);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }

      &:nth-child(3) {
        animation-delay: 0s;
      }
    }

    @keyframes bounce {
      0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.5;
      }
      40% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `]
})
export class TypingIndicatorComponent {
  @Input() visible: boolean = false;
  @Input() userName: string = '';
}
