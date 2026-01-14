import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonItem,
  IonLabel,
  IonToggle,
  IonIcon,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { fingerPrintOutline, eyeOutline } from 'ionicons/icons';
import { BiometricService } from '../../../core/auth/biometric.service';
import { SessionService } from '../../../core/auth/session';

/**
 * Toggle component for enabling/disabling biometric login
 * Use in profile or settings pages
 */
@Component({
  selector: 'app-biometric-toggle',
  standalone: true,
  imports: [
    CommonModule,
    IonItem,
    IonLabel,
    IonToggle,
    IonIcon
  ],
  template: `
    @if (biometricService.isBiometricAvailable() && biometricService.isInitialized()) {
      <ion-item>
        <ion-icon
          [name]="getIconName()"
          slot="start"
          color="primary">
        </ion-icon>
        <ion-label>
          <h2>{{ biometricService.getBiometryTypeName() }} Login</h2>
          <p>Quickly sign in using biometrics</p>
        </ion-label>
        <ion-toggle
          [checked]="biometricService.isBiometricEnabled()"
          (ionChange)="onToggle($event)"
          [disabled]="isLoading">
        </ion-toggle>
      </ion-item>
    }
  `,
  styles: [`
    ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
    }

    ion-icon {
      font-size: 24px;
      margin-right: 16px;
    }

    ion-label h2 {
      font-weight: 600;
    }

    ion-label p {
      color: var(--ion-color-medium);
      font-size: 14px;
    }
  `]
})
export class BiometricToggleComponent {
  biometricService = inject(BiometricService);
  private sessionService = inject(SessionService);
  private toastController = inject(ToastController);

  isLoading = false;

  constructor() {
    addIcons({ fingerPrintOutline, eyeOutline });
  }

  getIconName(): string {
    const typeName = this.biometricService.getBiometryTypeName();
    if (typeName.includes('Face')) {
      return 'eye-outline';
    }
    return 'finger-print-outline';
  }

  async onToggle(event: CustomEvent) {
    const enabled = event.detail.checked;
    this.isLoading = true;

    try {
      if (enabled) {
        const success = await this.sessionService.enableBiometricForCurrentSession();
        if (success) {
          await this.showToast(`${this.biometricService.getBiometryTypeName()} login enabled`, 'success');
        } else {
          // Revert toggle
          (event.target as HTMLIonToggleElement).checked = false;
          await this.showToast('Failed to enable biometric login', 'danger');
        }
      } else {
        const success = await this.sessionService.disableBiometric();
        if (success) {
          await this.showToast('Biometric login disabled', 'success');
        } else {
          // Revert toggle
          (event.target as HTMLIonToggleElement).checked = true;
          await this.showToast('Failed to disable biometric login', 'danger');
        }
      }
    } catch (error) {
      console.error('BiometricToggle: Error:', error);
      // Revert toggle
      (event.target as HTMLIonToggleElement).checked = !enabled;
      await this.showToast('An error occurred', 'danger');
    } finally {
      this.isLoading = false;
    }
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
