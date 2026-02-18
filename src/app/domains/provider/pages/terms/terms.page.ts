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
      title: 'Service Provider Agreement',
      content: `As an After5 service provider, you agree to:

      - Operate as an independent contractor, not an employee
      - Maintain valid credentials and documentation
      - Provide services professionally and to quality standards
      - Use the app honestly and accurately report job status
      - Comply with all applicable laws and regulations`
    },
    {
      title: 'Earnings & Payments',
      content: `Payment terms for service providers:

      - Earnings are based on completed and verified jobs
      - Platform fees are deducted from gross earnings
      - Payouts are processed to your registered payment method
      - Minimum payout thresholds may apply
      - You are responsible for your own taxes and contributions
      - Disputes must be raised within 7 days of transaction`
    },
    {
      title: 'Body Camera Policy',
      content: `Guidelines for body camera usage:

      - Body cameras are encouraged for mutual protection
      - You must inform customers when recording
      - Recordings must not be shared or used outside the platform
      - Footage may be requested for dispute resolution
      - Tampering with or deleting footage during disputes is prohibited
      - Privacy of customers must be respected at all times`
    },
    {
      title: 'Code of Conduct',
      content: `Expected behavior from all providers:

      - Maintain professional appearance and demeanor
      - Arrive on time and communicate delays promptly
      - Respect customer property and privacy
      - Never engage in harassment or discrimination
      - Do not solicit customers for off-platform services
      - Report any safety concerns immediately`
    },
    {
      title: 'Account Suspension & Termination',
      content: `Your account may be suspended or terminated for:

      - Violation of terms of service
      - Consistently low ratings or complaints
      - Fraudulent activity or misrepresentation
      - Safety violations or criminal behavior
      - Extended periods of inactivity
      - Failure to maintain required documentation`
    },
    {
      title: 'Liability & Insurance',
      content: `Understanding liability as a provider:

      - You are responsible for your own actions during service
      - Maintain appropriate insurance coverage where required
      - Report accidents or damage immediately through the app
      - After5's liability is limited as specified in full terms
      - Indemnification clauses apply for provider negligence`
    }
  ];

  goBack() {
    this.router.navigate(['/p/profile/about']);
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
