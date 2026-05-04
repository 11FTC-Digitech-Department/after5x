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
import { AccountDeletionService, AccountDeletionBlocker } from '../../../../core/services/account-deletion.service';
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
  private accountDeletionService = inject(AccountDeletionService);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);

  // State signals
  isLoading = signal(true);
  isLoggingOut = signal(false);
  isDeletingAccount = signal(false);
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
    },
    {
      title: 'Danger Zone',
      items: [
        { icon: 'trash-outline', label: 'Delete Account', action: 'deleteAccount', color: 'danger' }
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
    } else if (item.action === 'deleteAccount') {
      this.confirmDeleteAccount();
    }
  }

  private async confirmDeleteAccount() {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: 'Deleting your account will anonymize your profile, remove your login, and sign you out. Your past bookings and payment records stay available for reporting with your identity hidden. You can create a new account in the future. Resolve active bookings, pending payments, and open support tickets first.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Continue',
          role: 'destructive',
          handler: () => {
            this.confirmDeletePhrase();
          }
        }
      ]
    });

    await alert.present();
  }

  private async confirmDeletePhrase() {
    const alert = await this.alertController.create({
      header: 'Confirm Deletion',
      message: 'Type DELETE to permanently delete this account.',
      inputs: [
        {
          name: 'confirmation',
          type: 'text',
          placeholder: 'DELETE'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete Account',
          role: 'destructive',
          handler: async (data) => {
            if (data.confirmation !== 'DELETE') {
              await this.showToast('Type DELETE to confirm account deletion.', 'warning');
              return false;
            }
            await this.deleteAccount();
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private async deleteAccount() {
    if (this.isDeletingAccount()) {
      return;
    }

    this.isDeletingAccount.set(true);

    try {
      const result = await this.accountDeletionService.deleteAccount('DELETE');

      if (!result.success) {
        await this.showDeletionFailure(result.blockers, result.message || result.error);
        return;
      }

      await this.showToast(result.message || 'Your account has been deleted.', 'success');
      await this.sessionService.signOut();
    } catch (error) {
      devError('Account deletion failed:', error);
      await this.showToast('Unable to delete account. Please try again.', 'danger');
    } finally {
      this.isDeletingAccount.set(false);
    }
  }

  private async showDeletionFailure(blockers?: AccountDeletionBlocker[], fallback?: string) {
    const message = blockers?.length
      ? blockers.map(blocker => {
          const count = blocker.count && blocker.count > 1 ? ` (${blocker.count})` : '';
          return `${blocker.message}${count}`;
        }).join('\n')
      : (fallback || 'Your account cannot be deleted yet.');

    const alert = await this.alertController.create({
      header: blockers?.length ? 'Action Required' : 'Account Cannot Be Deleted',
      message,
      buttons: ['OK']
    });
    await alert.present();
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
