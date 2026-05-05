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
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
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
export class PrivacyPage {
  private router = inject(Router);

  readonly fullPolicyUrl = 'https://after5.ph/privacy-policy/';
  readonly lastUpdated = 'February 2026';

  readonly sections = [
    {
      title: 'Personal Data Collected',
      content: `As a service provider, we collect:

      - Identity information (name, ID documents, photos)
      - Contact information (email, phone, address)
      - Location data (real-time location during active jobs)
      - Financial information (bank details, earnings, tax information)
      - Performance data (ratings, reviews, completion rates)
      - Device and app usage information`
    },
    {
      title: 'Purposes of Processing',
      content: `Your personal data is processed for:

      - Verifying your identity and qualifications
      - Matching you with appropriate job requests
      - Processing payments and managing earnings
      - Ensuring safety for providers and customers
      - Improving service quality and platform features
      - Complying with legal and regulatory requirements`
    },
    {
      title: 'Body Camera Footage Policy',
      content: `Regarding body camera usage:

      - Body cameras are optional but encouraged for safety
      - You must notify customers when recording
      - Footage is stored securely on our servers
      - Recordings are accessed only for dispute resolution
      - Footage is retained for 30 days unless needed for investigations
      - Misuse of recordings violates our terms of service`
    },
    {
      title: 'Data Subject Rights',
      content: `You have the right to:

      - Access your personal data and earnings records
      - Correct inaccurate information
      - Delete your account from Profile when there are no active jobs, processing payouts, or open support tickets
      - Data portability for your work history
      - Object to certain processing activities

      When you delete your account, we anonymize account identity data. We may retain booking, payout, payment, support, audit, and legally required operational records.

      Contact our Data Protection Officer at privacy@after5.ph`
    },
    {
      title: 'Contact Information',
      content: `For privacy-related inquiries:

      Email: privacy@after5.ph
      Provider Support: provider-support@after5.ph
      Address: After5 Services Inc., Metro Manila, Philippines`
    }
  ];

  goBack() {
    this.router.navigate(['/p/profile/about']);
  }

  async openFullPolicy() {
    try {
      await Browser.open({ url: this.fullPolicyUrl });
    } catch (error) {
      devError('Error opening browser:', error);
      window.open(this.fullPolicyUrl, '_blank');
    }
  }
}
