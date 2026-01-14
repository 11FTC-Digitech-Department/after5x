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
  ToastController,
  Platform
} from '@ionic/angular/standalone';
import { LoginFormComponent, LoginFormData } from '../../components/login-form/login-form.component';
import { SignupFormComponent, SignupFormData } from '../../components/signup-form/signup-form.component';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { SessionService } from '../../../../core/auth/session';

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
    CommonModule,
    LoginFormComponent,
    SignupFormComponent
  ]
})
export class LoginPage implements OnInit {
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private toastController = inject(ToastController);
  private platform = inject(Platform);

  selectedSegment = signal<'login' | 'signup'>('login');
  isLoginLoading = signal<boolean>(false);
  isSignupLoading = signal<boolean>(false);

  constructor() { }

  ngOnInit() {
    // Check if user is already authenticated
    if (this.sessionService.isAuthenticated()) {
      this.navigateBasedOnRole();
    }
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
        this.navigateBasedOnRole();
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

  async onFacebookLogin() {
    console.log('Facebook login button clicked');
    console.log('Current platform detection:', {
      allPlatforms: this.platform.platforms(),
      isCapacitor: this.platform.is('capacitor'),
      isHybrid: this.platform.is('hybrid'),
      isMobile: this.platform.is('mobile'),
      userAgent: navigator.userAgent
    });

    this.isLoginLoading.set(true);

    try {
      const result = await this.supabaseService.signInWithProvider('facebook');
      console.log('Facebook login result:', result);

      if (!result.success) {
        console.error('Facebook login failed:', result.error);
        await this.showToast(result.error || 'Facebook login failed', 'danger');
      } else {
        console.log('Facebook OAuth initiated successfully');
      }
      // OAuth redirect will handle the success case
    } catch (error) {
      console.error('Facebook login error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoginLoading.set(false);
    }
  }

  async onGoogleLogin() {
    console.log('Google login button clicked');
    console.log('Current platform detection:', {
      allPlatforms: this.platform.platforms(),
      isCapacitor: this.platform.is('capacitor'),
      isHybrid: this.platform.is('hybrid'),
      isMobile: this.platform.is('mobile'),
      userAgent: navigator.userAgent
    });

    this.isLoginLoading.set(true);

    try {
      const result = await this.supabaseService.signInWithProvider('google');
      console.log('Google login result:', result);

      if (!result.success) {
        console.error('Google login failed:', result.error);
        await this.showToast(result.error || 'Google login failed', 'danger');
      } else {
        console.log('Google OAuth initiated successfully');
      }
      // OAuth redirect will handle the success case
    } catch (error) {
      console.error('Google login error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoginLoading.set(false);
    }
  }

  navigateToForgotPassword() {
    // Navigate to forgot password page
    this.router.navigate(['/auth/forgot-password']);
  }

  // Debug method for OAuth setup (can be called from console)
  debugOAuthSetup() {
    console.log('=== OAUTH DEBUG INFO ===');
    console.log('Platform detection:', {
      allPlatforms: this.platform.platforms(),
      isCapacitor: this.platform.is('capacitor'),
      isHybrid: this.platform.is('hybrid'),
      isIOS: this.platform.is('ios'),
      isAndroid: this.platform.is('android'),
      isMobile: this.platform.is('mobile'),
      isDesktop: this.platform.is('desktop'),
      isPWA: this.platform.is('pwa'),
      userAgent: navigator.userAgent
    });

    console.log('Redirect URLs:', {
      web: `${window.location.origin}/auth/callback`,
      mobile: 'com.rockit.after5://auth/callback'
    });

    console.log('Supabase config available:', !!this.supabaseService.client);
    console.log('Current URL:', window.location.href);
    console.log('=======================');
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

    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(formData.mobile.replace(/\s+/g, ''))) {
      this.showToast('Please enter a valid mobile number', 'warning');
      return false;
    }

    return true;
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
        this.router.navigate(['/c']);
        break;
      case 'provider':
        this.router.navigate(['/p']);
        break;
      case 'admin':
        this.router.navigate(['/a']);
        break;
      default:
        this.router.navigate(['/c']); // Default to customer
    }
  }
}
