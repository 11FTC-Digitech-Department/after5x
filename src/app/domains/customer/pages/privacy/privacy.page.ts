import { Component, inject } from '@angular/core';
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
  readonly lastUpdated = 'January 2024';

  readonly sections = [
    {
      title: 'Personal Data Collected',
      content: `We collect the following types of personal data:

      - Contact information (name, email, phone number)
      - Location data (service addresses, real-time location during active services)
      - Payment information (transaction history, payment method details)
      - Device information (device type, operating system, app version)
      - Usage data (service history, preferences, interactions with the app)`
    },
    {
      title: 'Purposes of Processing',
      content: `Your personal data is processed for the following purposes:

      - To facilitate service bookings and match you with providers
      - To process payments and maintain transaction records
      - To communicate service updates and important notifications
      - To improve our services and user experience
      - To ensure safety and security for all users
      - To comply with legal obligations`
    },
    {
      title: 'Body Camera Footage Policy',
      content: `For safety and quality assurance, service providers may use body cameras during service delivery:

      - Recordings are used only for dispute resolution and safety purposes
      - Footage is stored securely and accessed only when necessary
      - Recordings are automatically deleted after 30 days unless needed for an ongoing investigation
      - You may request access to footage related to your service within this retention period`
    },
    {
      title: 'Data Subject Rights',
      content: `Under applicable data protection laws, you have the following rights:

      - Right to access your personal data
      - Right to correct inaccurate data
      - Right to delete your data (subject to legal requirements)
      - Right to restrict processing
      - Right to data portability
      - Right to object to processing

      To exercise these rights, contact our Data Protection Officer at privacy@after5.ph`
    },
    {
      title: 'Contact Information',
      content: `For privacy-related inquiries:

      Email: privacy@after5.ph
      Address: After5 Services Inc., Metro Manila, Philippines

      For general support: support@after5.ph`
    }
  ];

  goBack() {
    this.router.navigate(['/c/profile/about']);
  }

  async openFullPolicy() {
    try {
      await Browser.open({ url: this.fullPolicyUrl });
    } catch (error) {
      console.error('Error opening browser:', error);
      window.open(this.fullPolicyUrl, '_blank');
    }
  }
}
