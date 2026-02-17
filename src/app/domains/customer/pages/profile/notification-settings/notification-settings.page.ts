import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { devLog } from '../../../../../core/utils/logger';
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
  IonToggle,
  IonListHeader,
  IonText,
  IonNote,
  ToastController
} from '@ionic/angular/standalone';
import { Preferences } from '@capacitor/preferences';
import { PushNotificationService, NotificationPreferences } from '../../../../../core/services/push-notification.service';

interface NotificationSetting {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  enabled: boolean;
}

interface NotificationSection {
  title: string;
  settings: NotificationSetting[];
}

@Component({
  selector: 'app-notification-settings',
  templateUrl: './notification-settings.page.html',
  styleUrls: ['./notification-settings.page.scss'],
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
    IonToggle,
    IonListHeader,
    IonText,
    IonNote,
    CommonModule,
    FormsModule
  ]
})
export class NotificationSettingsPage implements OnInit {
  private router = inject(Router);
  private toastController = inject(ToastController);
  private pushNotificationService = inject(PushNotificationService);

  private readonly STORAGE_KEY = 'notification_settings';
  private migrationComplete = false;

  isLoading = signal(true);

  // Settings aligned with NotificationPreferences interface
  sections = signal<NotificationSection[]>([
    {
      title: 'Booking Updates',
      settings: [
        {
          key: 'booking_confirmed',
          label: 'Booking Confirmed',
          description: 'When your booking is confirmed by a provider',
          enabled: true
        },
        {
          key: 'booking_started',
          label: 'Service Started',
          description: 'When the provider starts working on your booking',
          enabled: true
        },
        {
          key: 'booking_completed',
          label: 'Service Completed',
          description: 'When your service is completed',
          enabled: true
        },
        {
          key: 'booking_cancelled',
          label: 'Booking Cancelled',
          description: 'When a booking is cancelled',
          enabled: true
        }
      ]
    },
    {
      title: 'Provider Updates',
      settings: [
        {
          key: 'provider_on_way',
          label: 'Provider On the Way',
          description: 'When the provider is heading to your location',
          enabled: true
        },
        {
          key: 'provider_arrived',
          label: 'Provider Arrived',
          description: 'When the provider arrives at your location',
          enabled: true
        }
      ]
    },
    {
      title: 'Promotions & Updates',
      settings: [
        {
          key: 'promotions',
          label: 'Promotions',
          description: 'Special offers and discounts',
          enabled: false
        },
        {
          key: 'news_updates',
          label: 'News & Updates',
          description: 'New features and service updates',
          enabled: true
        }
      ]
    }
  ]);

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    try {
      this.isLoading.set(true);

      // First, try to migrate any existing local settings to server
      await this.migrateLocalSettings();

      // Load preferences from server
      await this.pushNotificationService.loadPreferences();
      const serverPrefs = this.pushNotificationService.preferences();

      if (serverPrefs) {
        const currentSections = this.sections();

        // Update UI with server preferences
        const updatedSections = currentSections.map(section => ({
          ...section,
          settings: section.settings.map(setting => ({
            ...setting,
            enabled: serverPrefs[setting.key] ?? setting.enabled
          }))
        }));

        this.sections.set(updatedSections);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Migrate existing local Capacitor Preferences to server-side storage
   */
  private async migrateLocalSettings(): Promise<void> {
    if (this.migrationComplete) return;

    try {
      const { value } = await Preferences.get({ key: this.STORAGE_KEY });

      if (value) {
        const localSettings = JSON.parse(value);
        devLog('Migrating local notification settings to server:', localSettings);

        // Update server with local settings
        const success = await this.pushNotificationService.updatePreferences(localSettings);

        if (success) {
          // Remove local settings after successful migration
          await Preferences.remove({ key: this.STORAGE_KEY });
          devLog('Local notification settings migrated successfully');
        }
      }
    } catch (error) {
      console.error('Error migrating local settings:', error);
    }

    this.migrationComplete = true;
  }

  async onToggleChange(setting: NotificationSetting) {
    try {
      // Update server-side preference
      const success = await this.pushNotificationService.updatePreference(setting.key, setting.enabled);

      if (success) {
        await this.showToast(
          `${setting.label} notifications ${setting.enabled ? 'enabled' : 'disabled'}`,
          'success'
        );
      } else {
        throw new Error('Failed to update preference');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      await this.showToast('Failed to save setting', 'danger');
      // Revert the change
      setting.enabled = !setting.enabled;
    }
  }

  goBack() {
    this.router.navigate(['/c/profile']);
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
