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
  IonLabel
} from '@ionic/angular/standalone';
import { LoginFormComponent, LoginFormData } from '../../components/login-form/login-form.component';
import { SignupFormComponent, SignupFormData } from '../../components/signup-form/signup-form.component';

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

  selectedSegment = signal<'login' | 'signup'>('login');

  constructor() { }

  ngOnInit() {
  }

  segmentChanged(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  onLogin(formData: LoginFormData) {
    // Handle login logic
    console.log('Login with:', formData);
  }

  onSignup(formData: SignupFormData) {
    // Handle signup logic and navigate to OTP verification
    console.log('Signup with:', formData);
    this.router.navigate(['/auth/verify-otp'], {
      state: { formData, type: 'signup' }
    });
  }

  onFacebookLogin() {
    // Handle Facebook login
    console.log('Facebook login');
  }

  onGoogleLogin() {
    // Handle Google login
    console.log('Google login');
  }

  navigateToForgotPassword() {
    // Navigate to forgot password page
    this.router.navigate(['/auth/forgot-password']);
  }
}
