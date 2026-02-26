import { Component, inject } from '@angular/core';
import { devError } from '../../../../../core/utils/logger';
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
  IonList,
  IonItem,
  IonLabel,
  IonText
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-about',
  templateUrl: './about.page.html',
  styleUrls: ['./about.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonText,
    CommonModule
  ]
})
export class AboutPage {
  private router = inject(Router);

  readonly appVersion = '1.0.0';
  readonly appName = 'After5 Provider';
  readonly companyName = 'After5 Services Inc.';

  readonly socialLinks = [
    { icon: 'globe-outline', label: 'Website', url: 'https://after5.ph' },
    { icon: 'logo-facebook', label: 'Facebook', url: 'https://facebook.com/after5ph' },
    { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/after5ph' }
  ];

  goBack() {
    this.router.navigate(['/p/profile']);
  }

  navigateToPrivacy() {
    this.router.navigate(['/p/privacy']);
  }

  navigateToTerms() {
    this.router.navigate(['/p/terms']);
  }

  async openLink(url: string) {
    try {
      await Browser.open({ url });
    } catch (error) {
      devError('Error opening link:', error);
      window.open(url, '_blank');
    }
  }
}
