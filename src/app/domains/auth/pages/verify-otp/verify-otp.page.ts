import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { SessionService } from '../../../../core/auth/session';
import { AuthFlowService } from '../../../../core/auth/auth-flow.service';

@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.page.html',
  styleUrls: ['./verify-otp.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonInput,
    IonButton,
    IonSpinner,
    CommonModule,
    FormsModule
  ]
})
export class VerifyOtpPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);
  private toastController = inject(ToastController);

  otpCode = '';
  email = '';
  verificationType: 'signup' | 'recovery' | 'email_change' = 'signup';
  isVerifying = signal<boolean>(false);
  isResending = signal<boolean>(false);
  countdownTimer = signal<number>(300); // 5 minutes in seconds
  timerDisplay = signal<string>('05:00');
  private timerInterval: any;

  ngOnInit() {
    // Get the form data from navigation state or query params
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      const { email, type } = navigation.extras.state as any;
      this.email = email || '';
      this.verificationType = type || 'signup';
    }

    // If not found in state, check query params
    if (!this.email) {
      const queryParams = this.route.snapshot.queryParams;
      this.email = queryParams['email'] || '';
      this.verificationType = (queryParams['type'] as 'signup' | 'recovery' | 'email_change') || 'signup';
    }

    // If no email found, redirect back to login
    if (!this.email) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Start the countdown timer
    this.startCountdownTimer();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  async onVerifyOtp() {
    if (!this.otpCode || this.otpCode.length < 6) {
      await this.showToast('Please enter a valid 6-digit code', 'warning');
      return;
    }

    this.isVerifying.set(true);

    try {
      const result = await this.supabaseService.verifyOtp(this.email, this.otpCode, this.verificationType);

      if (result.success) {
        await this.showToast('Verification successful!', 'success');

        if (this.verificationType === 'signup') {
          // Navigate to appropriate page based on user role after signup verification
          await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
        } else if (this.verificationType === 'recovery') {
          // Navigate to reset password page
          this.router.navigate(['/auth/reset-password']);
        }
      } else {
        // Handle specific OTP error cases
        const errorMessage = result.error || '';
        if (errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('invalid')) {
          await this.showToast('Code expired or invalid. Requesting a new code...', 'warning');
          // Auto-resend for expired codes
          setTimeout(() => this.autoResendOtp(), 1500);
        } else {
          await this.showToast(result.error || 'Verification failed', 'danger');
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isVerifying.set(false);
    }
  }

  async onResendOtp() {
    await this.resendOtpCode();
  }

  private async autoResendOtp() {
    await this.resendOtpCode(true);
  }

  private async resendOtpCode(isAuto = false) {
    // Only allow resend for signup and email_change types
    if (this.verificationType === 'recovery') {
      await this.showToast('Please use the reset password form to request a new code.', 'warning');
      return;
    }

    this.isResending.set(true);

    try {
      const result = await this.supabaseService.resendOtp(this.email, this.verificationType as 'signup' | 'email_change');

      if (result.success) {
        const message = isAuto ? 'New code sent due to expiry!' : 'Verification code sent! Please check your email.';
        await this.showToast(message, 'success');
        this.otpCode = ''; // Clear the current code
        this.resetCountdownTimer(); // Reset timer for new code
      } else {
        await this.showToast(result.error || 'Failed to resend code', 'danger');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isResending.set(false);
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }


  private startCountdownTimer() {
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      const currentTime = this.countdownTimer();
      if (currentTime > 0) {
        this.countdownTimer.set(currentTime - 1);
        this.updateTimerDisplay();
      } else {
        // Timer expired
        clearInterval(this.timerInterval);
        this.timerDisplay.set('Expired');
      }
    }, 1000);
  }

  private resetCountdownTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.countdownTimer.set(300); // Reset to 5 minutes
    this.startCountdownTimer();
  }

  private updateTimerDisplay() {
    const totalSeconds = this.countdownTimer();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.timerDisplay.set(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }
}
