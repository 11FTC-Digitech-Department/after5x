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
  IonInput,
  IonSpinner,
  IonAvatar,
  IonText,
  ToastController,
  ActionSheetController
} from '@ionic/angular/standalone';
import { SessionService } from '../../../../../core/auth/session';
import { ProfileService, ExtendedProfile } from '../../../../../core/services/profile.service';
import { CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
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
    IonInput,
    IonSpinner,
    IonAvatar,
    IonText,
    CommonModule,
    FormsModule
  ]
})
export class EditProfilePage implements OnInit {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);

  // State
  isLoading = signal(true);
  isSaving = signal(false);
  isUploadingAvatar = signal(false);

  // Form data
  fullName = signal('');
  phoneNumber = signal('');
  email = signal('');
  avatarUrl = signal<string | undefined>(undefined);

  // Original values for change detection
  private originalValues = {
    fullName: '',
    phoneNumber: ''
  };

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      this.isLoading.set(true);

      const result = await this.profileService.getExtendedProfile();

      if (result.error) {
        await this.showToast('Failed to load profile', 'danger');
        this.goBack();
        return;
      }

      if (result.data) {
        this.fullName.set(result.data.full_name || '');
        this.phoneNumber.set(result.data.phone_number || '');
        this.email.set(result.data.email || '');
        this.avatarUrl.set(result.data.avatar_url);

        this.originalValues = {
          fullName: result.data.full_name || '',
          phoneNumber: result.data.phone_number || ''
        };
      }
    } catch (error) {
      devError('Error loading profile:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  get hasChanges(): boolean {
    return this.fullName() !== this.originalValues.fullName ||
           this.phoneNumber() !== this.originalValues.phoneNumber;
  }

  get initials(): string {
    return this.profileService.getInitials(this.fullName());
  }

  async onAvatarClick() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Update Profile Photo',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => {
            this.uploadAvatar(CameraSource.Camera);
          }
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.uploadAvatar(CameraSource.Photos);
          }
        },
        ...(this.avatarUrl() ? [{
          text: 'Remove Photo',
          icon: 'trash',
          role: 'destructive' as const,
          handler: () => {
            this.removeAvatar();
          }
        }] : []),
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  private async uploadAvatar(source: CameraSource) {
    try {
      this.isUploadingAvatar.set(true);

      const result = await this.profileService.pickAndUploadAvatar(source);

      if (result.error) {
        if (result.error !== 'cancelled') {
          await this.showToast(result.error, 'danger');
        }
        return;
      }

      if (result.data) {
        this.avatarUrl.set(result.data);
      }

      await this.showToast('Profile photo updated', 'success');
    } catch (error) {
      devError('Error uploading avatar:', error);
      await this.showToast('Failed to upload photo', 'danger');
    } finally {
      this.isUploadingAvatar.set(false);
    }
  }

  private async removeAvatar() {
    try {
      this.isUploadingAvatar.set(true);

      const result = await this.profileService.deleteAvatar();

      if (result.error) {
        await this.showToast(result.error, 'danger');
        return;
      }

      this.avatarUrl.set(undefined);
      await this.showToast('Profile photo removed', 'success');
    } catch (error) {
      devError('Error removing avatar:', error);
      await this.showToast('Failed to remove photo', 'danger');
    } finally {
      this.isUploadingAvatar.set(false);
    }
  }

  async saveProfile() {
    if (!this.fullName().trim()) {
      await this.showToast('Name is required', 'warning');
      return;
    }

    if (!this.hasChanges) {
      this.goBack();
      return;
    }

    try {
      this.isSaving.set(true);

      const result = await this.profileService.updateProfile({
        full_name: this.fullName().trim(),
        phone_number: this.phoneNumber().trim() || undefined
      });

      if (result.error) {
        await this.showToast(result.error, 'danger');
        return;
      }

      await this.showToast('Profile updated successfully', 'success');
      this.goBack();
    } catch (error) {
      devError('Error saving profile:', error);
      await this.showToast('Failed to save profile', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/c/profile']);
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
