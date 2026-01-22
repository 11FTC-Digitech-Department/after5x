import {
  Component,
  input,
  output,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, receiptOutline } from 'ionicons/icons';

export interface PaymentSuccessData {
  amount: number | null;
  paymentMethod: string | null;
  bookingId: string;
}

@Component({
  selector: 'app-payment-success-modal',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  template: `
    <div class="success-overlay" [class.visible]="isVisible()">
      <!-- Confetti Container -->
      <div class="confetti-container">
        @for (i of confettiPieces; track i) {
          <div 
            class="confetti" 
            [style.--delay]="i * 0.1 + 's'"
            [style.--x]="getRandomX(i)"
            [style.--color]="getConfettiColor(i)">
          </div>
        }
      </div>

      <!-- Content -->
      <div class="success-content" [class.animate]="isVisible()">
        <!-- Animated Checkmark -->
        <div class="checkmark-container">
          <div class="checkmark-circle">
            <svg class="checkmark" viewBox="0 0 52 52">
              <circle class="checkmark-bg" cx="26" cy="26" r="25" fill="none"/>
              <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>
        </div>

        <!-- Title -->
        <h1 class="success-title">Payment Successful!</h1>

        <!-- Invoice Summary -->
        <div class="invoice-card">
          <div class="invoice-row">
            <span class="invoice-label">Amount</span>
            <span class="invoice-value amount">{{ formatPrice(amount()) }}</span>
          </div>
          @if (paymentMethod()) {
            <div class="invoice-row">
              <span class="invoice-label">Method</span>
              <span class="invoice-value">{{ formatPaymentMethod(paymentMethod()) }}</span>
            </div>
          }
          <div class="invoice-row">
            <span class="invoice-label">Booking</span>
            <span class="invoice-value booking-id">{{ getShortBookingId(bookingId()) }}</span>
          </div>
        </div>

        <!-- Thank you message -->
        <p class="thank-you">Thank you for your payment!</p>

        <!-- Action Button -->
        <ion-button 
          expand="block" 
          class="view-booking-btn"
          (click)="onViewBooking()">
          <ion-icon name="receipt-outline" slot="start"></ion-icon>
          View My Bookings
        </ion-button>

        <!-- Auto redirect countdown -->
        <p class="countdown-text">
          Auto-redirecting in {{ countdown() }}s
        </p>
      </div>
    </div>
  `,
  styleUrl: './payment-success-modal.component.scss'
})
export class PaymentSuccessModalComponent implements OnInit, OnDestroy {
  // Inputs
  amount = input<number | null>(null);
  paymentMethod = input<string | null>(null);
  bookingId = input.required<string>();

  // Output
  dismissed = output<void>();

  // State
  isVisible = signal(false);
  countdown = signal(4);

  // Confetti pieces (30 pieces for nice effect)
  confettiPieces = Array.from({ length: 30 }, (_, i) => i);
  private confettiColors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f'];

  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDismissing = false;
  private isDestroyed = false;

  constructor() {
    addIcons({ checkmarkCircle, receiptOutline });
  }

  ngOnInit() {
    // Small delay to trigger animation
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.isVisible.set(true);
      }
    }, 50);

    // Start countdown
    this.countdownInterval = setInterval(() => {
      if (this.isDestroyed) return;
      
      const current = this.countdown();
      if (current <= 1) {
        this.dismiss();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
  }

  onViewBooking() {
    this.dismiss();
  }

  private dismiss() {
    // Prevent multiple dismiss calls
    if (this.isDismissing || this.isDestroyed) return;
    this.isDismissing = true;

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    this.isVisible.set(false);
    
    // Small delay for exit animation
    this.dismissTimeout = setTimeout(() => {
      if (!this.isDestroyed) {
        this.dismissed.emit();
      }
    }, 300);
  }

  getRandomX(index: number): string {
    // Distribute confetti across the screen
    const baseX = (index / 30) * 100;
    const randomOffset = (Math.sin(index * 1.5) * 20);
    return `${baseX + randomOffset}vw`;
  }

  getConfettiColor(index: number): string {
    return this.confettiColors[index % this.confettiColors.length];
  }

  formatPrice(amount: number | null): string {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatPaymentMethod(method: string | null): string {
    if (!method) return '---';
    const methodDisplayMap: Record<string, string> = {
      'CREDIT_CARD': 'Credit Card',
      'DEBIT_CARD': 'Debit Card',
      'GCASH': 'GCash',
      'GRAB_PAY': 'GrabPay',
      'GRABPAY': 'GrabPay',
      'PAYMAYA': 'PayMaya',
      'MAYA': 'Maya',
      'BPI': 'BPI Online',
      'UNIONBANK': 'UnionBank',
      'CEBUANA': 'Cebuana',
      'ECPAY': 'ECPay',
      '7ELEVEN': '7-Eleven',
      'CARDS': 'Card',
      'QRPH': 'QR Ph',
      'SHOPEEPAY': 'ShopeePay'
    };
    return methodDisplayMap[method.toUpperCase()] || method;
  }

  getShortBookingId(id: string | null): string {
    if (!id) return '---';
    return `#${id.slice(-6).toUpperCase()}`;
  }
}
