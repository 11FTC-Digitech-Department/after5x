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
  IonInput,
  IonTextarea,
  IonSpinner,
  IonText,
  IonNote,
  ToastController
} from '@ionic/angular/standalone';
import { ProfileService, ProviderProfile } from '../../../../../core/services/profile.service';

@Component({
  selector: 'app-business-profile',
  templateUrl: './business-profile.page.html',
  styleUrls: ['./business-profile.page.scss'],
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
    IonTextarea,
    IonSpinner,
    IonText,
    IonNote,
    CommonModule,
    FormsModule
  ]
})
export class BusinessProfilePage implements OnInit {
  private router = inject(Router);
  private profileService = inject(ProfileService);
  private toastController = inject(ToastController);

  // State
  isLoading = signal(true);
  isSaving = signal(false);

  // Form data
  bio = signal('');
  yearsOfExperience = signal<number | null>(null);

  // Original values for change detection
  private originalValues = {
    bio: '',
    yearsOfExperience: null as number | null
  };

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    try {
      this.isLoading.set(true);

      const result = await this.profileService.getProviderProfile();

      if (result.error) {
        await this.showToast('Failed to load business profile', 'danger');
        this.goBack();
        return;
      }

      if (result.data) {
        this.bio.set(result.data.bio || '');
        this.yearsOfExperience.set(result.data.years_of_experience || null);

        this.originalValues = {
          bio: result.data.bio || '',
          yearsOfExperience: result.data.years_of_experience || null
        };
      }
    } catch (error) {
      console.error('Error loading business profile:', error);
      await this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  get hasChanges(): boolean {
    return this.bio() !== this.originalValues.bio ||
           this.yearsOfExperience() !== this.originalValues.yearsOfExperience;
  }

  get bioCharCount(): number {
    return this.bio().length;
  }

  async saveProfile() {
    if (!this.hasChanges) {
      this.goBack();
      return;
    }

    try {
      this.isSaving.set(true);

      const result = await this.profileService.updateProviderProfile({
        bio: this.bio().trim() || undefined,
        years_of_experience: this.yearsOfExperience() || undefined
      });

      if (result.error) {
        await this.showToast(result.error, 'danger');
        return;
      }

      await this.showToast('Business profile updated', 'success');
      this.goBack();
    } catch (error) {
      console.error('Error saving business profile:', error);
      await this.showToast('Failed to save business profile', 'danger');
    } finally {
      this.isSaving.set(false);
    }
  }

  onYearsChange(event: any) {
    const value = event.target.value;
    if (value === '' || value === null) {
      this.yearsOfExperience.set(null);
    } else {
      const num = parseInt(value, 10);
      this.yearsOfExperience.set(isNaN(num) ? null : Math.max(0, Math.min(num, 50)));
    }
  }

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
