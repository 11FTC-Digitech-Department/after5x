import { Component, OnInit, inject, signal } from '@angular/core';
import { devWarn, devError } from '../../../../../core/utils/logger';
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
import { App } from '@capacitor/app';

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
export class AboutPage implements OnInit {
  private router = inject(Router);

  appVersion = signal<string | null>(null);
  buildNumber = signal<string | null>(null);
  readonly appName = 'After5 Provider';
  readonly companyName = 'After5 Services Inc.';

  readonly socialLinks = [
    { icon: 'globe-outline', label: 'Website', url: 'https://after5.ph' },
    { icon: 'logo-facebook', label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61579077682041' },
    { icon: 'logo-instagram', label: 'Instagram', url: 'https://www.instagram.com/after5_ph/' }
  ];

  ngOnInit() {
    this.loadAppInfo();
  }

  private async loadAppInfo(): Promise<void> {
    try {
      const info = await App.getInfo();
      this.appVersion.set(info.version ?? null);
      this.buildNumber.set(info.build ?? null);
    } catch (error) {
      devWarn('AboutPage: Could not get app info:', error);
      this.appVersion.set('0.0.1');
      this.buildNumber.set('1');
    }
  }

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
