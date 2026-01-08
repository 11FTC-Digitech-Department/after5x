import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.page.html',
  styleUrls: ['./verify-otp.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonInput,
    IonButton,
    CommonModule,
    FormsModule
  ]
})
export class VerifyOtpPage implements OnInit {
  private router = inject(Router);

  otpCode = '';
  mobileNumber = '';
  verificationType: 'signup' | 'login' = 'signup';

  ngOnInit() {
    // Get the form data from navigation state
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      const { formData, type } = navigation.extras.state as any;
      this.mobileNumber = formData?.mobile || '';
      this.verificationType = type || 'signup';
    }
  }

  onVerifyOtp() {
    // Handle OTP verification logic
    console.log('Verifying OTP:', this.otpCode, 'for mobile:', this.mobileNumber);
    // TODO: Implement actual OTP verification
    // For now, navigate back to login on success
    this.router.navigate(['/auth/login']);
  }

  onResendOtp() {
    // Handle resend OTP logic
    console.log('Resending OTP to:', this.mobileNumber);
  }
}
