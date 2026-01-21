import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
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
  IonText,
  IonBadge,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ModalController,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { AddressService } from '../../../../../core/supabase/address.service';
import { AddressFormComponent } from '../../../../../core/components/address-form/address-form.component';
import { UserAddress } from '../../../../../core/models/address.model';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.page.html',
  styleUrls: ['./addresses.page.scss'],
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
    IonText,
    IonBadge,
    IonFab,
    IonFabButton,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    CommonModule,
    FormsModule
  ]
})
export class AddressesPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private addressService = inject(AddressService);
  private modalController = inject(ModalController);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // State
  addresses = signal<UserAddress[]>([]);
  isLoading = signal(true);
  isRefreshing = signal(false);

  // Computed
  hasAddresses = computed(() => this.addresses().length > 0);
  defaultAddress = computed(() =>
    this.addresses().find(addr => addr.is_default) || null
  );

  ngOnInit() {
    this.loadAddresses();
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  async loadAddresses() {
    try {
      this.isLoading.set(true);
      const result = await this.addressService.getUserAddresses();

      if (result.error) {
        this.showToast('Failed to load addresses: ' + result.error, 'danger');
      } else {
        this.addresses.set(result.data || []);
      }
    } catch (error) {
      this.showToast('An unexpected error occurred', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: any) {
    try {
      this.isRefreshing.set(true);
      await this.loadAddresses();
    } finally {
      this.isRefreshing.set(false);
      event.target.complete();
    }
  }

  async addNewAddress() {
    const modal = await this.modalController.create({
      component: AddressFormComponent,
      componentProps: {
        address: null
      },
      breakpoints: [0, 0.8, 1],
      initialBreakpoint: 0.8
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.role === 'save' && result.data) {
        await this.loadAddresses();
      }
    });

    await modal.present();
  }

  async editAddress(address: UserAddress) {
    const modal = await this.modalController.create({
      component: AddressFormComponent,
      componentProps: {
        address: address
      },
      breakpoints: [0, 0.8, 1],
      initialBreakpoint: 0.8
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.role === 'save' && result.data) {
        await this.loadAddresses();
      }
    });

    await modal.present();
  }

  async deleteAddress(address: UserAddress) {
    const alert = await this.alertController.create({
      header: 'Delete Address',
      message: `Are you sure you want to delete your ${address.label} address?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const result = await this.addressService.deleteAddress(address.id);

              if (result.error) {
                this.showToast('Failed to delete address: ' + result.error, 'danger');
              } else {
                this.showToast('Address deleted successfully', 'success');
                await this.loadAddresses();
              }
            } catch (error) {
              this.showToast('An unexpected error occurred', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async setAsDefault(address: UserAddress) {
    try {
      const result = await this.addressService.setDefaultAddress(address.id);

      if (result.error) {
        this.showToast('Failed to set default address: ' + result.error, 'danger');
      } else {
        this.showToast(`${address.label} set as default address`, 'success');
        await this.loadAddresses();
      }
    } catch (error) {
      this.showToast('An unexpected error occurred', 'danger');
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

  getAddressIcon(label: string): string {
    const iconMap: { [key: string]: string } = {
      'Home': 'home',
      'Work': 'business',
      'School': 'school',
      'Gym': 'fitness',
      'Restaurant': 'restaurant',
      'Park': 'leaf',
      'Hospital': 'medical',
      'Mall': 'storefront',
      'Airport': 'airplane',
      'Other': 'location'
    };
    return iconMap[label] || 'location';
  }
}
