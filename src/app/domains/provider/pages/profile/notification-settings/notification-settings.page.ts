import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  private readonly STORAGE_KEY = 'provider_notification_settings';
  private migrationComplete = false;

  isLoading = signal(true);

  // Settings aligned with NotificationPreferences interface
  sections = signal<NotificationSection[]>([
    {
      title: 'Job Notifications',
      settings: [
        {
          key: 'new_job',
          label: 'New Job Requests',
          description: 'When a new job matches your services',
          enabled: true
        },
        {
          key: 'job_confirmed',
          label: 'Job Confirmed',
          description: 'When a customer confirms your acceptance',
          enabled: true
        },
        {
          key: 'job_cancelled',
          label: 'Job Cancelled',
          description: 'When a customer cancels a booking',
          enabled: true
        },
        {
          key: 'job_reminder',
          label: 'Job Reminders',
          description: 'Reminders before scheduled jobs',
          enabled: true
        }
      ]
    },
    {
      title: 'Payment Notifications',
      settings: [
        {
          key: 'payment_received',
          label: 'Payment Received',
          description: 'When payment for a job is confirmed',
          enabled: true
        },
        {
          key: 'payout_processed',
          label: 'Payout Processed',
          description: 'When your earnings are transferred',
          enabled: true
        }
      ]
    },
    {
      title: 'Account Updates',
      settings: [
        {
          key: 'verification_status',
          label: 'Verification Status',
          description: 'Updates on document verification',
          enabled: true
        },
        {
          key: 'reviews',
          label: 'New Reviews',
          description: 'When customers leave reviews',
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
          description: 'Tips to earn more and special opportunities',
          enabled: false
        },
        {
          key: 'news_updates',
          label: 'News & Updates',
          description: 'New features and platform updates',
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
        console.log('Migrating local notification settings to server:', localSettings);

        // Update server with local settings
        const success = await this.pushNotificationService.updatePreferences(localSettings);

        if (success) {
          // Remove local settings after successful migration
          await Preferences.remove({ key: this.STORAGE_KEY });
          console.log('Local notification settings migrated successfully');
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
    this.router.navigate(['/p/profile']);
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
