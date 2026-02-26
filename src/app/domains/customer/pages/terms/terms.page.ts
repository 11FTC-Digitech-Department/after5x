import { Component, inject } from '@angular/core';
import { devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonText,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.page.html',
  styleUrls: ['./terms.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    CommonModule
  ]
})
export class TermsPage {
  private router = inject(Router);

  readonly fullTermsUrl = 'https://after5.ph/terms-conditions/';
  readonly lastUpdated = 'February 2026';

  readonly sections = [
    {
      title: 'Service Overview',
      content: `After5 is a platform that connects customers with independent service providers for home services. Key points:

      - After5 acts as an intermediary, not as the service provider
      - Service providers are independent contractors, not employees of After5
      - Quality standards are maintained through provider verification and customer reviews
      - Services are subject to availability in your area`
    },
    {
      title: 'Payments',
      content: `Payment terms for services booked through After5:

      - Prices displayed are estimates and may vary based on actual service requirements
      - Payment is due upon completion of the service
      - Accepted payment methods include cash and GCash
      - Service fees and any applicable taxes will be clearly displayed before booking confirmation
      - Promotional codes and discounts are subject to specific terms and conditions`
    },
    {
      title: 'Body Camera Policy',
      content: `For transparency and safety, service providers may use body cameras:

      - Customers will be notified when a provider uses a body camera
      - Recordings serve as evidence in case of disputes or incidents
      - Footage is handled according to our Privacy Policy
      - Obstructing or tampering with recording devices is prohibited`
    },
    {
      title: 'User Conduct',
      content: `All users must adhere to the following conduct guidelines:

      - Provide accurate information when creating accounts and bookings
      - Treat service providers with respect and professionalism
      - Ensure a safe working environment for providers
      - Not engage in harassment, discrimination, or illegal activities
      - Not misuse the platform for fraudulent purposes`
    },
    {
      title: 'Complaints and Refunds',
      content: `Our process for handling complaints and refunds:

      - Complaints should be submitted within 48 hours of service completion
      - Each case is reviewed individually by our support team
      - Refunds may be issued for services not rendered or significantly below standard
      - Partial refunds may apply based on the nature of the complaint
      - Decisions on refunds are final and made at After5's discretion`
    },
    {
      title: 'Liability Limitations',
      content: `Important limitations on After5's liability:

      - After5 is not liable for actions of independent service providers
      - Maximum liability is limited to the amount paid for the specific service
      - After5 is not responsible for indirect, incidental, or consequential damages
      - Users are responsible for securing valuables before service appointments
      - Force majeure events may affect service delivery without liability`
    }
  ];

  goBack() {
    this.router.navigate(['/c/profile/about']);
  }

  async openFullTerms() {
    try {
      await Browser.open({ url: this.fullTermsUrl });
    } catch (error) {
      devError('Error opening browser:', error);
      window.open(this.fullTermsUrl, '_blank');
    }
  }
}
