import { Component, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  onSignup() {
    this.signup.emit(this.signupForm);
  }

  togglePasswordVisibility() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  toggleConfirmPasswordVisibility() {
    this.isConfirmPasswordVisible = !this.isConfirmPasswordVisible;
  }
}
