import { Component, OnInit, signal, inject, ViewChild, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
  ToastController,
  AlertController
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
import { SignupSuccessModalComponent } from '../../../../shared/components/signup-success-modal/signup-success-modal.component';

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
    SignupFormComponent,
    SignupSuccessModalComponent
  ]
})
export class LoginPage implements OnInit, AfterViewChecked {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);
  private cdr = inject(ChangeDetectorRef);
  biometricService = inject(BiometricService);

  @ViewChild('signupForm') signupFormComponent?: SignupFormComponent;
  private shouldResetForm = signal<boolean>(false);

  selectedSegment = signal<'login' | 'signup'>('login');
  isLoginLoading = signal<boolean>(false);
  isSignupLoading = signal<boolean>(false);
  isBiometricLoading = signal<boolean>(false);
  appVersion = signal<string>('0.0.0');
  buildNumber = signal<string>('1');
  environmentType = signal<string>('dev');
  appType = signal<'customer' | 'experts'>('customer');
  isExpertsApp = signal<boolean>(false);
  showSuccessModal = signal<boolean>(false);
  successModalType = signal<'customer' | 'provider'>('customer');

  constructor() {
    addIcons({ fingerPrintOutline, eyeOutline });
  }

  // Ensure we always land on the Login tab when this page becomes active
  ionViewWillEnter() {
    // Check query params and set segment accordingly
    const tabParam = this.route.snapshot.queryParams['tab'];
    if (tabParam === 'login') {
      this.selectedSegment.set('login');
    } else if (tabParam === 'signup') {
      // In provider build, redirect to provider-application instead of showing signup form
      if (this.isExpertsApp()) {
        this.router.navigate(['/provider-application']);
        return;
      }
      this.selectedSegment.set('signup');
    } else {
      // No tab param or unknown value - default to login
      this.selectedSegment.set('login');
    }
  }

  async ngOnInit() {
    // Auth check is now handled by guestGuard - no need to check here

    // Check for query parameter to set initial tab
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'login') {
        this.selectedSegment.set('login');
      } else if (params['tab'] === 'signup') {
        // In provider build, redirect to provider-application instead of showing signup form
        if (this.isExpertsApp()) {
          this.router.navigate(['/provider-application']);
          return;
        }
        this.selectedSegment.set('signup');
      }
    });

    // Check for preserved navigation state and show appropriate message
    const navigationState = await this.authFlowService.consumeNavigationState();
    if (navigationState?.reason) {
      const message = this.authFlowService.getRedirectReasonMessage(navigationState.reason);
      await this.showToast(message, 'warning');
    }

    // Get app version and build info
    this.loadAppInfo();
  }

  ngAfterViewChecked() {
    // Reset form if flag is set and component is available
    if (this.shouldResetForm() && this.signupFormComponent) {
      this.signupFormComponent.resetForm();
      this.shouldResetForm.set(false);
    }
  }

  private async loadAppInfo() {
    try {
      const info = await App.getInfo();
      this.appVersion.set(info.version);
      this.buildNumber.set(info.build);
      
      // Detect app type based on package name
      const isExperts = info.id?.includes('experts') ?? false;
      this.isExpertsApp.set(isExperts);
      this.appType.set(isExperts ? 'experts' : 'customer');
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
    const newSegment = event.detail.value;
    
    // In provider build, redirect to provider-application when signup is selected
    if (newSegment === 'signup' && this.isExpertsApp()) {
      this.router.navigate(['/provider-application']);
      return;
    }
    
    this.selectedSegment.set(newSegment);
    
    // Clear signup form when switching to login tab
    if (newSegment === 'login') {
      this.shouldResetForm.set(true);
    }
  }

  onSignupSegmentClick() {
    // For provider build, always redirect to provider application
    if (this.isExpertsApp()) {
      this.router.navigate(['/provider-application']);
    }
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
        // Wait for profile to load
        await this.waitForProfile();
        
        const profile = this.sessionService.profile();
        
        // Check if account is activated
        if (profile && profile.activated === false) {
          // Sign out the user
          await this.sessionService.signOut();
          await this.showAccountNotActivatedAlert();
          this.isLoginLoading.set(false);
          return;
        }

        // Account is activated, proceed with login
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

  private async waitForProfile(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const profile = this.sessionService.profile();
      if (profile) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async onSignup(formData: SignupFormData) {
    if (!this.validateSignupForm(formData)) {
      return;
    }

    // Check if this is a provider build - redirect to application form
    if (this.isExpertsApp()) {
      this.router.navigate(['/provider-application']);
      return;
    }

    this.isSignupLoading.set(true);
    
    // Set signup flag to prevent auto-navigation during signup
    this.sessionService.setSignupInProgress(true);

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
        // Profile is automatically created by database trigger with activated=true for customer
        // Show success modal instead of navigating to OTP
        this.successModalType.set('customer');
        this.showSuccessModal.set(true);
      } else {
        await this.showToast(result.error || 'Signup failed', 'danger');
        // Clear signup flag on error
        setTimeout(() => {
          this.sessionService.setSignupInProgress(false);
        }, 100);
      }
    } catch (error) {
      console.error('Signup error:', error);
      await this.showToast('An unexpected error occurred', 'danger');
      // Clear signup flag on error
      setTimeout(() => {
        this.sessionService.setSignupInProgress(false);
      }, 100);
    } finally {
      this.isSignupLoading.set(false);
    }
  }

  onSuccessModalDismissed() {
    this.showSuccessModal.set(false);
    // Switch to login tab and clear form
    this.selectedSegment.set('login');
    this.shouldResetForm.set(true);
    // Clear signup flag after modal is dismissed
    setTimeout(() => {
      this.sessionService.setSignupInProgress(false);
    }, 100);
  }

  async onBiometricLogin() {
    if (!this.biometricService.isBiometricEnabled()) {
      return;
    }

    this.isBiometricLoading.set(true);

    try {
      const result = await this.sessionService.loginWithBiometric();

      if (result.success) {
        // Wait for profile to load
        await this.waitForProfile();
        
        const profile = this.sessionService.profile();
        
        // Check if account is activated
        if (profile && profile.activated === false) {
          // Sign out the user
          await this.sessionService.signOut();
          await this.showAccountNotActivatedAlert();
          this.isBiometricLoading.set(false);
          return;
        }

        // Account is activated, proceed with login
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

  navigateToProviderApplication() {
    // Navigate to provider application form
    this.router.navigate(['/provider-application']);
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

  private async showAccountNotActivatedAlert() {
    const alert = await this.alertController.create({
      header: 'Account Pending Activation',
      message: 'Your account is currently under review. We\'ll notify you via email once your account has been activated. Thank you for your patience!',
      buttons: ['OK'],
      cssClass: 'account-not-activated-alert'
    });
    await alert.present();
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
