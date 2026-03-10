import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { devWarn, devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonListHeader,
  IonText,
  ToastController,
  ActionSheetController,
  AlertController
} from '@ionic/angular/standalone';
import { SessionService } from '../../../../core/auth/session';
import { ProfileService, ExtendedProfile } from '../../../../core/services/profile.service';
import { ProfileCardComponent } from '../../../../shared/components/profile-card/profile-card.component';
import { CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';

interface MenuItem {
  icon: string;
  label: string;
  route?: string;
  action?: string;
  color?: string;
}

interface MenuSection {
  title: string | null;
  items: MenuItem[];
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonListHeader,
    IonText,
    CommonModule,
    FormsModule,
    ProfileCardComponent
  ]
})
export class ProfilePage implements OnInit {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);

  // State signals
  isLoading = signal(true);
  isLoggingOut = signal(false);
  isUploadingAvatar = signal(false);
  profile = signal<ExtendedProfile | null>(null);

  // App info signals (from Capacitor App.getInfo)
  appVersion = signal<string | null>(null);
  buildNumber = signal<string | null>(null);

  // Menu sections for customer
  menuSections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit Profile', route: '/c/profile/edit' },
        { icon: 'location-outline', label: 'Addresses', route: '/c/profile/addresses' }
      ]
    },
    {
      title: 'Preferences',
      items: [
        { icon: 'notifications-outline', label: 'Notifications', route: '/c/profile/notifications' }
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: 'help-circle-outline', label: 'Help & Support', route: '/c/profile/support' },
        { icon: 'information-circle-outline', label: 'About', route: '/c/profile/about' }
      ]
    },
    {
      title: null,
      items: [
        { icon: 'log-out-outline', label: 'Logout', action: 'logout', color: 'danger' }
      ]
    }
  ];

  constructor() {
    // React to session changes
    effect(() => {
      const sessionProfile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (!isLoading && sessionProfile) {
        this.loadProfileData();
      }
    });
  }

  ngOnInit() {
    // Initial profile load handled by effect
    this.loadAppInfo();
  }

  private async loadAppInfo(): Promise<void> {
    try {
      const info = await App.getInfo();
      this.appVersion.set(info.version ?? null);
      this.buildNumber.set(info.build ?? null);
    } catch (error) {
      devWarn('ProfilePage: Could not get app info:', error);
      // Fallback values if Capacitor App info is unavailable
      this.appVersion.set('0.0.1');
      this.buildNumber.set('1');
    }
  }

  async loadProfileData() {
    try {
      this.isLoading.set(true);

      const result = await this.profileService.getExtendedProfile();

      if (result.error) {
        await this.showToast('Failed to load profile', 'danger');
        return;
      }

      this.profile.set(result.data || null);
    } catch (error) {
      devError('Error loading profile:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    try {
      await this.loadProfileData();
    } finally {
      event.target.complete();
    }
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
        ...(this.profile()?.avatar_url ? [{
          text: 'Remove Photo',
          icon: 'trash',
          role: 'destructive' as const,
          handler: () => {
            this.confirmRemoveAvatar();
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

      // Update local profile with new avatar
      const currentProfile = this.profile();
      if (currentProfile && result.data) {
        this.profile.set({ ...currentProfile, avatar_url: result.data });
      }

      await this.showToast('Profile photo updated', 'success');
    } catch (error) {
      devError('Error uploading avatar:', error);
      await this.showToast('Failed to upload photo', 'danger');
    } finally {
      this.isUploadingAvatar.set(false);
    }
  }

  private async confirmRemoveAvatar() {
    const alert = await this.alertController.create({
      header: 'Remove Photo',
      message: 'Are you sure you want to remove your profile photo?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            await this.removeAvatar();
          }
        }
      ]
    });

    await alert.present();
  }

  private async removeAvatar() {
    try {
      this.isUploadingAvatar.set(true);

      const result = await this.profileService.deleteAvatar();

      if (result.error) {
        await this.showToast(result.error, 'danger');
        return;
      }

      // Update local profile
      const currentProfile = this.profile();
      if (currentProfile) {
        this.profile.set({ ...currentProfile, avatar_url: undefined });
      }

      await this.showToast('Profile photo removed', 'success');
    } catch (error) {
      devError('Error removing avatar:', error);
      await this.showToast('Failed to remove photo', 'danger');
    } finally {
      this.isUploadingAvatar.set(false);
    }
  }

  onMenuItemClick(item: MenuItem) {
    if (item.route) {
      this.router.navigateByUrl(item.route);
    } else if (item.action === 'logout') {
      this.confirmLogout();
    }
  }

  private async confirmLogout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => {
            this.logout();
          }
        }
      ]
    });

    await alert.present();
  }

  private async logout() {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);

    try {
      await this.sessionService.signOut();
    } catch (error) {
      devError('Logout failed:', error);
      await this.showToast('Logout failed. Please try again.', 'danger');
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  getMemberSince(): string {
    return this.profileService.formatMemberSince(this.profile()?.created_at);
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
