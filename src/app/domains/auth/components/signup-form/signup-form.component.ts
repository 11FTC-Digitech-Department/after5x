import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonItem,
  IonInput,
  IonButton,
  IonRow,
  IonCol,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoGoogle, eye, eyeOff } from 'ionicons/icons';

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
    IonRow,
    IonCol,
    IonIcon
  ]
})
export class SignupFormComponent {
  signup = output<SignupFormData>();
  facebookLogin = output<void>();
  googleLogin = output<void>();

  signupForm: SignupFormData = {
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  };

  isPasswordVisible = false;
  isConfirmPasswordVisible = false;

  constructor() {
    addIcons({ logoFacebook, logoGoogle, eye, eyeOff });
  }

  onSignup() {
    this.signup.emit(this.signupForm);
  }

  onFacebookLogin() {
    this.facebookLogin.emit();
  }

  onGoogleLogin() {
    this.googleLogin.emit();
  }

  togglePasswordVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  toggleConfirmPasswordVisibility() {
    this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
  }
}
