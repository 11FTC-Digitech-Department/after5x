import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonRow,
  IonCol,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logoFacebook, logoGoogle, eye, eyeOff } from 'ionicons/icons';

export interface LoginFormData {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonRow,
    IonCol,
    IonIcon
  ]
})
export class LoginFormComponent {
  login = output<LoginFormData>();
  facebookLogin = output<void>();
  googleLogin = output<void>();
  forgotPassword = output<void>();

  loginForm: LoginFormData = {
    email: '',
    password: ''
  };

  isPasswordVisible = false;

  constructor() {
    addIcons({ logoFacebook, logoGoogle, eye, eyeOff });
  }

  onLogin() {
    this.login.emit(this.loginForm);
  }

  onFacebookLogin() {
    this.facebookLogin.emit();
  }

  onGoogleLogin() {
    this.googleLogin.emit();
  }

  onForgotPassword() {
    this.forgotPassword.emit();
  }

  togglePasswordVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }
}
