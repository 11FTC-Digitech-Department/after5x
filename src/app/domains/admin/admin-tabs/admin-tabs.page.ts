import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, peopleOutline, personOutline,
  calendarOutline, layersOutline, logOutOutline
} from 'ionicons/icons';
import { SessionService } from '@core/auth/session';
import { devError } from '@core/utils/logger';

@Component({
  selector: 'app-admin-tabs',
  templateUrl: './admin-tabs.page.html',
  styleUrls: ['./admin-tabs.page.scss'],
  standalone: true,
  imports: [
    IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel,
    CommonModule, RouterModule
  ]
})
export class AdminTabsPage {
  private sessionService = inject(SessionService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  isLoggingOut = signal(false);

  constructor() {
    addIcons({ homeOutline, peopleOutline, personOutline, calendarOutline, layersOutline, logOutOutline });
  }

  async confirmLogout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => { this.logout(); }
        }
      ]
    });
    await alert.present();
  }

  private async logout() {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    try {
      await this.sessionService.signOut();
    } catch (error) {
      devError('Admin logout failed:', error);
      const toast = await this.toastController.create({
        message: 'Logout failed. Please try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
