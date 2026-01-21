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

interface NotificationSetting {
  key: string;
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

  private readonly STORAGE_KEY = 'provider_notification_settings';

  isLoading = signal(true);

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

      const { value } = await Preferences.get({ key: this.STORAGE_KEY });

      if (value) {
        const savedSettings = JSON.parse(value);
        const currentSections = this.sections();

        const updatedSections = currentSections.map(section => ({
          ...section,
          settings: section.settings.map(setting => ({
            ...setting,
            enabled: savedSettings[setting.key] ?? setting.enabled
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

  async onToggleChange(setting: NotificationSetting) {
    try {
      const settings: Record<string, boolean> = {};
      this.sections().forEach(section => {
        section.settings.forEach(s => {
          settings[s.key] = s.enabled;
        });
      });

      await Preferences.set({
        key: this.STORAGE_KEY,
        value: JSON.stringify(settings)
      });

      await this.showToast(
        `${setting.label} notifications ${setting.enabled ? 'enabled' : 'disabled'}`,
        'success'
      );
    } catch (error) {
      console.error('Error saving notification settings:', error);
      await this.showToast('Failed to save setting', 'danger');
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
