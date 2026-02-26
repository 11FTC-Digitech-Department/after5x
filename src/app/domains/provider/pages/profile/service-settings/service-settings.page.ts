import { Component, OnInit, inject, signal } from '@angular/core';
import { devError } from '../../../../../core/utils/logger';
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
  IonRange,
  IonSpinner,
  IonText,
  IonNote,
  IonListHeader,
  IonDatetime,
  IonModal,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { ProfileService, isProviderActive } from '../../../../../core/services/profile.service';

@Component({
  selector: 'app-service-settings',
  templateUrl: './service-settings.page.html',
  styleUrls: ['./service-settings.page.scss'],
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
    IonRange,
    IonSpinner,
    IonText,
    IonNote,
    IonListHeader,
    IonDatetime,
    IonModal,
    CommonModule,
    FormsModule
  ]
})
export class ServiceSettingsPage implements OnInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  isLoading = signal(true);
  isSaving = signal(false);

  // Settings
  isAvailable = signal(true);
  serviceRadius = signal(15); // km
  workingHoursStart = signal('08:00');
  workingHoursEnd = signal('18:00');

  // Time picker modal state
  showStartTimePicker = signal(false);
  showEndTimePicker = signal(false);

  // Original values
  private originalValues = {
    isAvailable: true,
    serviceRadius: 15
  };

  readonly radiusOptions = {
    min: 5,
    max: 50,
    step: 5
  };

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    try {
      this.isLoading.set(true);

      const result = await this.profileService.getProviderProfile();

      if (result.error) {
        await this.showToast('Failed to load settings', 'danger');
        this.goBack();
        return;
      }

      if (result.data) {
        const isActive = isProviderActive(result.data);
        this.isAvailable.set(isActive);
        this.serviceRadius.set(result.data.service_radius_km ?? 15);

        this.originalValues = {
          isAvailable: isActive,
          serviceRadius: result.data.service_radius_km ?? 15
        };
      }
    } catch (error) {
      devError('Error loading settings:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  get hasChanges(): boolean {
    return this.isAvailable() !== this.originalValues.isAvailable ||
           this.serviceRadius() !== this.originalValues.serviceRadius;
  }

  onRadiusChange(event: any) {
    this.serviceRadius.set(event.detail.value);
  }

  async onAvailabilityChange() {
    const intendedNew = !this.isAvailable();
    this.isSaving.set(true);

    const confirmed = await this.confirmAvailabilityChange(intendedNew);
    if (!confirmed) {
      this.isSaving.set(false);
      return;
    }

    this.isAvailable.set(intendedNew);

    try {
      const result = await this.profileService.updateProviderProfile({
        status: this.isAvailable() ? 'online' : 'offline'
      });

      if (result.error) {
        this.isAvailable.set(!this.isAvailable());
        await this.showToast(result.error, 'danger');
        return;
      }

      this.originalValues.isAvailable = this.isAvailable();
      await this.showToast(
        this.isAvailable() ? 'You are now available for jobs' : 'You are now offline',
        'success'
      );
    } catch (error) {
      devError('Error updating availability:', error);
      this.isAvailable.set(!this.isAvailable());
      await this.showToast('Failed to update availability', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async confirmAvailabilityChange(newStatus: boolean): Promise<boolean> {
    const alert = await this.alertController.create({
      header: newStatus ? 'Go online?' : 'Go offline?',
      message: newStatus
        ? 'You will start receiving new job requests.'
        : 'You will stop receiving new job requests. Existing jobs are not affected.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: newStatus ? 'Go online' : 'Go offline', role: 'confirm' }
      ]
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  async saveRadius() {
    if (this.serviceRadius() === this.originalValues.serviceRadius) {
      return;
    }

    try {
      this.isSaving.set(true);

      const result = await this.profileService.updateProviderProfile({
        service_radius_km: this.serviceRadius()
      });

      if (result.error) {
        await this.showToast(result.error, 'danger');
        return;
      }

      this.originalValues.serviceRadius = this.serviceRadius();
      await this.showToast('Service radius updated', 'success');
    } catch (error) {
      devError('Error updating radius:', error);
      await this.showToast('Failed to update radius', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  onStartTimeChange(event: any) {
    this.workingHoursStart.set(event.detail.value);
    this.showStartTimePicker.set(false);
  }

  onEndTimeChange(event: any) {
    this.workingHoursEnd.set(event.detail.value);
    this.showEndTimePicker.set(false);
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  formatRadius = (value: number): string => {
    return `${value} km`;
  };

  goBack() {
    this.router.navigate(['/p/profile']);
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
