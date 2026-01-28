import { Component, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, close } from 'ionicons/icons';

export type SignupSuccessType = 'customer' | 'provider';

@Component({
  selector: 'app-signup-success-modal',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  template: `
    <div class="modal-overlay" [class.visible]="isVisible()">
      <div class="modal-content" [class.animate]="isVisible()">
        <div class="modal-inner">
          <!-- Success Icon -->
          <div class="success-icon-container">
            <ion-icon name="checkmark-circle" class="success-icon"></ion-icon>
          </div>

          <!-- Title -->
          <h2 class="modal-title">{{ getTitle() }}</h2>

          <!-- Message -->
          <p class="modal-message">{{ getMessage() }}</p>

          <!-- Countdown Message -->
          @if (autoDismiss() && countdown() > 0) {
            <p class="countdown-message">
              Redirecting to login in {{ countdown() }} second{{ countdown() !== 1 ? 's' : '' }}...
            </p>
          }

          <!-- Action Button -->
          <ion-button
            expand="block"
            class="modal-button"
            (click)="onDismiss()">
            OK
          </ion-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease-out;
    }

    .modal-overlay.visible {
      opacity: 1;
    }

    .modal-content {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      transform: translateY(20px);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out;
    }

    .modal-content.animate {
      transform: translateY(0);
      opacity: 1;
    }

    .modal-inner {
      width: 100%;
      max-width: 500px;
      text-align: center;
    }

    .success-icon-container {
      margin-bottom: 32px;
    }

    .success-icon {
      font-size: 80px;
      color: var(--ion-color-success);
    }

    .modal-title {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 16px 0;
    }

    .modal-message {
      font-size: 18px;
      color: #6b7280;
      margin: 0 0 16px 0;
      line-height: 1.6;
    }

    .countdown-message {
      font-size: 16px;
      color: #9ca3af;
      margin: 0 0 32px 0;
      font-weight: 500;
    }

    .modal-button {
      --border-radius: 8px;
      height: 52px;
      font-weight: 600;
      font-size: 16px;
      max-width: 300px;
      margin: 0 auto;
    }

    @media (prefers-color-scheme: dark) {
      .modal-overlay {
        background: #111827;
      }

      .modal-title {
        color: #f3f4f6;
      }

      .modal-message {
        color: #9ca3af;
      }
    }
  `]
})
export class SignupSuccessModalComponent implements OnInit, OnDestroy {
  // Inputs
  type = input.required<SignupSuccessType>();
  autoDismiss = input<boolean>(true);
  autoDismissDelay = input<number>(10000);

  // Outputs
  dismissed = output<void>();

  // State
  isVisible = signal(false);
  countdown = signal<number>(10);
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({ checkmarkCircle, close });
  }

  ngOnInit() {
    // Small delay to trigger animation
    setTimeout(() => {
      this.isVisible.set(true);
    }, 10);

    // Auto-dismiss if enabled
    if (this.autoDismiss()) {
      const delay = this.autoDismissDelay();
      const initialCountdown = Math.ceil(delay / 1000);
      this.countdown.set(initialCountdown);

      // Start countdown interval
      this.countdownInterval = setInterval(() => {
        const current = this.countdown();
        if (current > 1) {
          this.countdown.set(current - 1);
        } else {
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
          }
        }
      }, 1000);

      // Set dismiss timeout
      this.dismissTimeout = setTimeout(() => {
        this.onDismiss();
      }, delay);
    }
  }

  ngOnDestroy() {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  getTitle(): string {
    return this.type() === 'customer' 
      ? 'Sign Up Successful!' 
      : 'Application Submitted!';
  }

  getMessage(): string {
    return this.type() === 'customer'
      ? 'Please verify your email to start using After5.'
      : 'Thanks for applying. We\'re reviewing your application and will notify you once approved.';
  }

  onDismiss() {
    this.isVisible.set(false);
    setTimeout(() => {
      this.dismissed.emit();
      // Navigation is handled by parent component (login page)
    }, 300);
  }
}
