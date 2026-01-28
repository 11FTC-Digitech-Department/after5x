import { Component, output, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonItem,
  IonInput,
  IonButton,
  IonRow,
  IonCol,
  IonIcon,
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';

export interface SignupFormData {
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-signup-form',
  templateUrl: './signup-form.component.html',
  styleUrls: ['./signup-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonSpinner
  ]
})
export class SignupFormComponent {
  private router = inject(Router);

  signup = output<SignupFormData>();

  isLoading = input<boolean>(false);

  signupForm: SignupFormData = {
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  };

  isPasswordVisible = false;
  isConfirmPasswordVisible = false;

  constructor() {
    addIcons({ eye, eyeOff });
  }

  resetForm() {
    this.signupForm = {
      email: '',
      mobile: '',
      password: '',
      confirmPassword: ''
    };
    this.isPasswordVisible = false;
    this.isConfirmPasswordVisible = false;
  }

  onSignup() {
    this.signup.emit(this.signupForm);
  }

  togglePasswordVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  toggleConfirmPasswordVisibility() {
    this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
  }

  navigateToProviderApplication() {
    this.router.navigate(['/provider-application']);
  }
}
