import { Injectable, inject } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';

export interface AuthErrorContext {
  provider?: string;
  action?: 'login' | 'signup' | 'otp' | 'biometric' | 'session';
  retryable?: boolean;
}

export interface ErrorRecoveryAction {
  label: string;
  action: () => void | Promise<void>;
}

/**
 * Centralized service for handling authentication errors
 * Provides user-friendly messages and recovery actions
 */
@Injectable({
  providedIn: 'root'
})
export class AuthErrorService {
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private router = inject(Router);

  // Map of error keys to user-friendly messages
  private errorMessages = new Map<string, string>([
    // Supabase Auth Errors
    ['invalid_credentials', 'Invalid email or password. Please try again.'],
    ['email_not_confirmed', 'Please verify your email address before signing in.'],
    ['user_already_exists', 'An account with this email already exists.'],
    ['weak_password', 'Password must be at least 6 characters long.'],
    ['invalid_email', 'Please enter a valid email address.'],
    ['otp_expired', 'Verification code has expired. Please request a new one.'],
    ['invalid_otp', 'Invalid verification code. Please check and try again.'],
    ['too_many_requests', 'Too many attempts. Please wait before trying again.'],
    ['over_email_send_rate_limit', 'Email rate limit exceeded. Please wait a few minutes before trying again.'],

    // OAuth Errors
    ['access_denied', 'Login was cancelled or denied.'],

    // Network Errors
    ['network_error', 'Network error. Please check your connection.'],
    ['server_error', 'Server error. Please try again later.'],

    // Session Errors
    ['session_expired', 'Your session has expired. Please sign in again.'],
    ['session_not_found', 'No active session. Please sign in.'],
    ['session_timeout', 'Session establishment timed out. Please try again.'],

    // Biometric Errors
    ['biometric_cancelled', 'Biometric authentication was cancelled.'],
    ['biometric_failed', 'Biometric authentication failed.'],
    ['biometric_lockout', 'Biometric locked. Use password to unlock.'],
    ['biometric_not_enrolled', 'No biometrics enrolled on this device.'],
    ['biometric_not_available', 'Biometric authentication not available.'],

    // Phone OTP Errors
    ['phone_invalid', 'Please enter a valid Philippine mobile number (09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX).'],
    ['sms_send_failed', 'Failed to send SMS. Please try again.'],

    // Lock Errors
    ['lock_timeout', 'Authentication service busy. Please try again.']
  ]);

  /**
   * Handle an authentication error with appropriate UI feedback
   */
  async handleError(
    error: any,
    context?: AuthErrorContext
  ): Promise<void> {
    const errorKey = this.parseErrorKey(error);
    const message = this.getErrorMessage(errorKey, error);
    const recoveryActions = this.getRecoveryActions(errorKey, context);

    console.error('AuthError:', { error, errorKey, context, message });

    if (recoveryActions.length > 0) {
      await this.showErrorAlert(message, recoveryActions);
    } else {
      await this.showErrorToast(message);
    }
  }

  /**
   * Show a simple error toast
   */
  async showErrorToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Show a success toast
   */
  async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(errorKey: string, originalError?: any): string {
    const mapped = this.errorMessages.get(errorKey);
    if (mapped) return mapped;

    // Fallback to original error message if available
    if (originalError?.message) {
      return originalError.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Parse error into a normalized key
   */
  private parseErrorKey(error: any): string {
    if (typeof error === 'string') {
      return this.normalizeErrorKey(error);
    }

    const message = error?.message || error?.error_description || '';
    const messageLower = message.toLowerCase();

    // Map common Supabase error messages to keys
    if (messageLower.includes('invalid login credentials')) return 'invalid_credentials';
    if (messageLower.includes('email not confirmed')) return 'email_not_confirmed';
    if (messageLower.includes('already registered')) return 'user_already_exists';
    if (messageLower.includes('at least 6 characters')) return 'weak_password';
    if (messageLower.includes('token has expired')) return 'otp_expired';
    if (messageLower.includes('invalid token') || messageLower.includes('invalid otp')) return 'invalid_otp';
    if (messageLower.includes('too many requests')) return 'too_many_requests';
    if (messageLower.includes('email rate limit') || error?.code === 'over_email_send_rate_limit') return 'over_email_send_rate_limit';
    if (messageLower.includes('network')) return 'network_error';
    if (messageLower.includes('navigatorlock') || messageLower.includes('lock')) return 'lock_timeout';
    if (messageLower.includes('access_denied') || messageLower.includes('cancelled')) return 'access_denied';
    if (messageLower.includes('session expired')) return 'session_expired';

    // Check error name
    if (error?.name === 'NavigatorLockAcquireTimeoutError') return 'lock_timeout';

    return 'unknown_error';
  }

  /**
   * Normalize an error key
   */
  private normalizeErrorKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Get recovery actions for specific error types
   */
  private getRecoveryActions(
    errorKey: string,
    context?: AuthErrorContext
  ): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = [];

    switch (errorKey) {
      case 'email_not_confirmed':
        actions.push({
          label: 'Resend Verification',
          action: () => this.router.navigate(['/auth/verify-otp'])
        });
        break;

      case 'session_expired':
      case 'session_not_found':
        actions.push({
          label: 'Sign In',
          action: () => this.router.navigate(['/auth/login'])
        });
        break;

      case 'biometric_lockout':
        actions.push({
          label: 'Use Password',
          action: () => {} // Parent handles this
        });
        break;

      case 'biometric_not_enrolled':
        actions.push({
          label: 'Go to Settings',
          action: () => {} // Parent handles navigation to device settings
        });
        break;
    }

    return actions;
  }

  /**
   * Show an alert with recovery actions
   */
  private async showErrorAlert(
    message: string,
    actions: ErrorRecoveryAction[]
  ): Promise<void> {
    const buttons = actions.map(action => ({
      text: action.label,
      handler: () => {
        action.action();
        return true;
      }
    }));

    buttons.push({
      text: 'Cancel',
      role: 'cancel' as any,
      handler: () => true
    });

    const alert = await this.alertController.create({
      header: 'Authentication Error',
      message,
      buttons
    });
    await alert.present();
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error: any): boolean {
    const errorKey = this.parseErrorKey(error);
    const retryableKeys = [
      'network_error',
      'server_error',
      'lock_timeout',
      'session_timeout'
    ];
    return retryableKeys.includes(errorKey);
  }
}
