import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
export class VerifyOtpPage implements OnInit {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private toastController = inject(ToastController);

  otpCode = '';
  email = '';
  verificationType: 'signup' | 'recovery' | 'email_change' = 'signup';
  isVerifying = signal<boolean>(false);
  isResending = signal<boolean>(false);

  ngOnInit() {
    // Get the form data from navigation state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      const { email, type } = navigation.extras.state as any;
      this.email = email || '';
      this.verificationType = type || 'signup';
    }

    // If no email in state, redirect back to login
    if (!this.email) {
      this.router.navigate(['/auth/login']);
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
          // Navigate to appropriate page based on user role
          this.navigateBasedOnRole();
        } else if (this.verificationType === 'recovery') {
          // Navigate to reset password page
          this.router.navigate(['/auth/reset-password']);
        }
      } else {
        await this.showToast(result.error || 'Verification failed', 'danger');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isVerifying.set(false);
    }
  }

  async onResendOtp() {
    // Only allow resend for signup and email_change types
    if (this.verificationType === 'recovery') {
      await this.showToast('Please use the reset password form to request a new code.', 'warning');
      return;
    }

    this.isResending.set(true);

    try {
      const result = await this.supabaseService.resendOtp(this.email, this.verificationType as 'signup' | 'email_change');

      if (result.success) {
        await this.showToast('Verification code sent! Please check your email.', 'success');
        this.otpCode = ''; // Clear the current code
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
      position: 'top'
    });
    await toast.present();
  }

  private navigateBasedOnRole() {
    const role = this.sessionService.userRole();
    switch (role) {
      case 'customer':
        this.router.navigate(['/customer']);
        break;
      case 'provider':
        this.router.navigate(['/provider']);
        break;
      case 'admin':
        this.router.navigate(['/admin']);
        break;
      default:
        this.router.navigate(['/customer']); // Default to customer
    }
  }
}
