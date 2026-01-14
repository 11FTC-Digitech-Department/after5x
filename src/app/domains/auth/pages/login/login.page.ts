import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { fingerPrintOutline, eyeOutline } from 'ionicons/icons';
import { LoginFormComponent, LoginFormData } from '../../components/login-form/login-form.component';
import { SignupFormComponent, SignupFormData } from '../../components/signup-form/signup-form.component';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { SessionService } from '../../../../core/auth/session';
import { BiometricService } from '../../../../core/auth/biometric.service';
import { AuthFlowService } from '../../../../core/auth/auth-flow.service';
import { App } from '@capacitor/app';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    CommonModule,
    LoginFormComponent,
    SignupFormComponent
  ]
})
export class LoginPage implements OnInit {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);
  private toastController = inject(ToastController);
  biometricService = inject(BiometricService);

  selectedSegment = signal<'login' | 'signup'>('login');
  isLoginLoading = signal<boolean>(false);
  isSignupLoading = signal<boolean>(false);
  isBiometricLoading = signal<boolean>(false);
  appVersion = signal<string>('0.0.0');
  buildNumber = signal<string>('1');
  environmentType = signal<string>('dev');

  constructor() {
    addIcons({ fingerPrintOutline, eyeOutline });
  }

  async ngOnInit() {
    // Check if user is already authenticated
    if (this.sessionService.isAuthenticated()) {
      await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
      return;
    }

    // Check for preserved navigation state and show appropriate message
    const navigationState = await this.authFlowService.consumeNavigationState();
    if (navigationState?.reason) {
      const message = this.authFlowService.getRedirectReasonMessage(navigationState.reason);
      await this.showToast(message, 'warning');
    }

    // Get app version and build info
    this.loadAppInfo();
  }

  private async loadAppInfo() {
    try {
      const info = await App.getInfo();
      this.appVersion.set(info.version);
      this.buildNumber.set(info.build);
    } catch (error) {
      console.warn('Could not get app info:', error);
      // Fallback to package.json version
      this.appVersion.set('0.0.1');
      this.buildNumber.set('1');
    }

    // Set environment type
    this.environmentType.set(environment.production ? 'live' : 'dev');
  }

  segmentChanged(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  async onLogin(formData: LoginFormData) {
    if (!formData.email || !formData.password) {
      await this.showToast('Please fill in all fields', 'warning');
      return;
    }

    this.isLoginLoading.set(true);

    try {
      const result = await this.supabaseService.signInWithEmail(formData.email, formData.password);

      if (result.success) {
        await this.showToast('Login successful!', 'success');
        await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
      } else {
        await this.showToast(result.error || 'Login failed', 'danger');
      }
    } catch (error) {
      console.error('Login error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoginLoading.set(false);
    }
  }

  async onSignup(formData: SignupFormData) {
    if (!this.validateSignupForm(formData)) {
      return;
    }

    this.isSignupLoading.set(true);

    try {
      const result = await this.supabaseService.signUpWithEmail(
        formData.email,
        formData.password,
        {
          phone: formData.mobile,
          role: 'customer' // Default role, can be changed later
        }
      );

      if (result.success && result.user) {
        // Profile is automatically created by database trigger
        await this.showToast('Please check your email for verification code', 'success');
        this.router.navigate(['/auth/verify-otp'], {
          state: {
            email: formData.email,
            type: 'signup'
          }
        });
      } else {
        await this.showToast(result.error || 'Signup failed', 'danger');
      }
    } catch (error) {
      console.error('Signup error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isSignupLoading.set(false);
    }
  }

  async onBiometricLogin() {
    if (!this.biometricService.isBiometricEnabled()) {
      return;
    }

    this.isBiometricLoading.set(true);

    try {
      const result = await this.sessionService.loginWithBiometric();

      if (result.success) {
        await this.showToast('Welcome back!', 'success');
        await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
      } else {
        await this.showToast(result.error || 'Biometric login failed', 'danger');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isBiometricLoading.set(false);
    }
  }

  getBiometricIcon(): string {
    const typeName = this.biometricService.getBiometryTypeName();
    if (typeName.includes('Face')) {
      return 'eye-outline';
    }
    return 'finger-print-outline';
  }

  navigateToForgotPassword() {
    // Navigate to forgot password page
    this.router.navigate(['/auth/forgot-password']);
  }

  private validateSignupForm(formData: SignupFormData): boolean {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.mobile) {
      this.showToast('Please fill in all fields', 'warning');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      this.showToast('Passwords do not match', 'warning');
      return false;
    }

    if (formData.password.length < 6) {
      this.showToast('Password must be at least 6 characters long', 'warning');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      this.showToast('Please enter a valid email address', 'warning');
      return false;
    }

    const phoneRegex = /^(\+639|639|09)\d{9}$/;
    if (!phoneRegex.test(formData.mobile.replace(/\s+/g, ''))) {
      this.showToast('Please enter a valid Philippine mobile number (09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX)', 'warning');
      return false;
    }

    return true;
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      color,
      position: 'bottom'
    });
    await toast.present();
  }


}
