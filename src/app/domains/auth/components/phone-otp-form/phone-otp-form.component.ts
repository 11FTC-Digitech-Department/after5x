import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { phonePortraitOutline, arrowBackOutline } from 'ionicons/icons';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { AUTH_CONFIG } from '../../../../core/auth/auth.config';

type OtpStep = 'phone' | 'verify';

/**
 * Phone OTP login form component
 * Two-step flow: enter phone -> verify code
 */
@Component({
  selector: 'app-phone-otp-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon
  ],
  template: `
    <div class="phone-otp-form">
      @if (currentStep() === 'phone') {
        <div class="step-phone">
          <ion-item>
            <ion-icon name="phone-portrait-outline" slot="start"></ion-icon>
            <ion-input
              type="tel"
              label="Phone Number"
              labelPlacement="floating"
              placeholder="+1 234 567 8900"
              [(ngModel)]="phoneNumber"
              [disabled]="isLoading()"
              (keyup.enter)="sendOtp()">
            </ion-input>
          </ion-item>

          <p class="hint-text">
            Enter your phone number with country code to receive a verification code.
          </p>

          <ion-button
            expand="block"
            class="send-button"
            (click)="sendOtp()"
            [disabled]="isLoading() || !isValidPhone()">
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Send Verification Code
            }
          </ion-button>
        </div>
      }

      @if (currentStep() === 'verify') {
        <div class="step-verify">
          <ion-text color="medium">
            <p class="info-text">
              Enter the {{ codeLength }}-digit code sent to<br>
              <strong>{{ phoneNumber }}</strong>
            </p>
          </ion-text>

          <ion-item>
            <ion-input
              type="text"
              label="Verification Code"
              labelPlacement="floating"
              placeholder="123456"
              [(ngModel)]="otpCode"
              [maxlength]="codeLength"
              [disabled]="isLoading()"
              (keyup.enter)="verifyOtp()"
              inputmode="numeric"
              pattern="[0-9]*">
            </ion-input>
          </ion-item>

          <ion-button
            expand="block"
            class="verify-button"
            (click)="verifyOtp()"
            [disabled]="isLoading() || otpCode.length < codeLength">
            @if (isLoading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Verify & Sign In
            }
          </ion-button>

          <div class="action-buttons">
            <ion-button
              fill="clear"
              size="small"
              (click)="resendOtp()"
              [disabled]="isLoading() || resendCountdown() > 0">
              @if (resendCountdown() > 0) {
                Resend in {{ resendCountdown() }}s
              } @else {
                Resend Code
              }
            </ion-button>

            <ion-button
              fill="clear"
              size="small"
              (click)="changePhone()">
              <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
              Change Number
            </ion-button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .phone-otp-form {
      padding: 1rem 0;
    }

    ion-item {
      --padding-start: 0;
      --inner-padding-end: 0;
      margin-bottom: 1rem;
    }

    .hint-text {
      font-size: 14px;
      color: var(--ion-color-medium);
      margin: 0 0 1.5rem 0;
      text-align: center;
    }

    .info-text {
      text-align: center;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .send-button,
    .verify-button {
      margin-top: 1rem;
      --border-radius: 8px;
      height: 48px;
      font-weight: 600;
    }

    .action-buttons {
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
    }

    ion-spinner {
      width: 24px;
      height: 24px;
    }
  `]
})
export class PhoneOtpFormComponent implements OnDestroy {
  @Output() onSuccess = new EventEmitter<void>();
  @Output() onError = new EventEmitter<string>();

  private supabaseService = inject(SupabaseService);

  phoneNumber = '';
  otpCode = '';
  codeLength = AUTH_CONFIG.phoneOtp.codeLength;

  currentStep = signal<OtpStep>('phone');
  isLoading = signal<boolean>(false);
  resendCountdown = signal<number>(0);

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({ phonePortraitOutline, arrowBackOutline });
  }

  ngOnDestroy() {
    this.clearCountdown();
  }

  isValidPhone(): boolean {
    const phone = this.phoneNumber.replace(/\s+/g, '');
    // Philippine phone validation: 09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX
    const phoneRegex = /^(\+639|639|09)\d{9}$/;
    return phoneRegex.test(phone);
  }

  async sendOtp() {
    if (!this.isValidPhone()) {
      this.onError.emit('Please enter a valid Philippine mobile number (09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX)');
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.supabaseService.signInWithPhone(this.phoneNumber);

      if (result.success) {
        this.currentStep.set('verify');
        this.startResendCountdown();
      } else {
        this.onError.emit(result.error || 'Failed to send verification code');
      }
    } catch (error: any) {
      this.onError.emit(error.message || 'An unexpected error occurred');
    } finally {
      this.isLoading.set(false);
    }
  }

  async verifyOtp() {
    if (this.otpCode.length < this.codeLength) {
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.supabaseService.verifyPhoneOtp(
        this.phoneNumber,
        this.otpCode
      );

      if (result.success) {
        this.onSuccess.emit();
      } else {
        this.onError.emit(result.error || 'Invalid verification code');
      }
    } catch (error: any) {
      this.onError.emit(error.message || 'Verification failed');
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendOtp() {
    if (this.resendCountdown() > 0) return;
    await this.sendOtp();
  }

  changePhone() {
    this.currentStep.set('phone');
    this.otpCode = '';
    this.clearCountdown();
  }

  private startResendCountdown() {
    this.resendCountdown.set(AUTH_CONFIG.phoneOtp.resendCooldownSeconds);

    this.countdownInterval = setInterval(() => {
      const current = this.resendCountdown();
      if (current > 0) {
        this.resendCountdown.set(current - 1);
      } else {
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.resendCountdown.set(0);
  }
}
