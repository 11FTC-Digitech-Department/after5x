import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonButton,
  IonText
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    CommonModule,
    FormsModule
  ]
})
export class ForgotPasswordPage implements OnInit {
  private router = inject(Router);

  forgotForm = {
    email: ''
  };

  constructor() { }

  ngOnInit() {
  }

  onForgotPassword() {
    // Handle forgot password logic
    console.log('Forgot password for:', this.forgotForm);
  }

  backToLogin() {
    // Navigate back to login page
    this.router.navigate(['/auth/login']);
  }
}
