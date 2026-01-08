import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoGoogle } from 'ionicons/icons';

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
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonIcon,
    CommonModule,
    FormsModule
  ]
})
export class LoginPage implements OnInit {
  private router = inject(Router);

  selectedSegment = signal<'login' | 'signup'>('login');

  loginForm = {
    email: '',
    password: ''
  };

  signupForm = {
    email: '',
    password: '',
    confirmPassword: ''
  };

  constructor() {
    addIcons({ logoFacebook, logoGoogle });
  }

  ngOnInit() {
  }

  segmentChanged(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  onLogin() {
    // Handle login logic
    console.log('Login with:', this.loginForm);
  }

  onSignup() {
    // Handle signup logic
    console.log('Signup with:', this.signupForm);
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
