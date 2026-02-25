import { ChangeDetectionStrategy, Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
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
  AlertController,
} from '@ionic/angular/standalone';
import { SessionService } from '../../../../core/auth/session';
import { ProfileService, ExtendedProfile } from '../../../../core/services/profile.service';
import { ProfileCardComponent } from '../../../../shared/components/profile-card/profile-card.component';
import { CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { addIcons } from 'ionicons';
import { personOutline, logOutOutline } from 'ionicons/icons';

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
  selector: 'app-admin-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
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
    ProfileCardComponent,
  ],
})
export class AdminProfilePage implements OnInit {
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private profileService = inject(ProfileService);
  private toastController = inject(ToastController);
  private actionSheetController = inject(ActionSheetController);
  private alertController = inject(AlertController);

  isLoading = signal(true);
  isLoggingOut = signal(false);
  isUploadingAvatar = signal(false);
  profile = signal<ExtendedProfile | null>(null);

  appVersion = signal<string | null>(null);
  buildNumber = signal<string | null>(null);

  menuSections: MenuSection[] = [
    {
      title: 'Account',
      items: [{ icon: 'person-outline', label: 'Edit Profile', route: '/a/profile/edit' }],
    },
    {
      title: null,
      items: [{ icon: 'log-out-outline', label: 'Logout', action: 'logout', color: 'danger' }],
    },
  ];

  constructor() {
    addIcons({ personOutline, logOutOutline });
    effect(() => {
      const sessionProfile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      if (!isLoading && sessionProfile) {
        this.loadProfileData();
      }
    });
  }

  ngOnInit() {
    this.loadAppInfo();
  }

  private async loadAppInfo(): Promise<void> {
    try {
      const info = await App.getInfo();
      this.appVersion.set(info.version ?? null);
      this.buildNumber.set(info.build ?? null);
    } catch {
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

      this.profile.set(result.data ?? null);
    } catch (error) {
      console.error('Error loading profile:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: { target: { complete: () => void } }) {
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
          },
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.uploadAvatar(CameraSource.Photos);
          },
        },
        ...(this.profile()?.avatar_url
          ? [
              {
                text: 'Remove Photo',
                icon: 'trash',
                role: 'destructive' as const,
                handler: () => {
                  this.confirmRemoveAvatar();
                },
              },
            ]
          : []),
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel',
        },
      ],
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

      const currentProfile = this.profile();
      if (currentProfile && result.data) {
        this.profile.set({ ...currentProfile, avatar_url: result.data });
      }

      await this.showToast('Profile photo updated', 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
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
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            await this.removeAvatar();
          },
        },
      ],
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

      const currentProfile = this.profile();
      if (currentProfile) {
        this.profile.set({ ...currentProfile, avatar_url: undefined });
      }

      await this.showToast('Profile photo removed', 'success');
    } catch (error) {
      console.error('Error removing avatar:', error);
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
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => {
            this.logout();
          },
        },
      ],
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
      console.error('Logout failed:', error);
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
      position: 'bottom',
    });
    await toast.present();
  }
}
