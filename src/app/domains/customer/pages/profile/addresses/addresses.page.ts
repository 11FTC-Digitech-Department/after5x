import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
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
import { GoogleMapsService } from '../../../../../core/services/google-maps.service';
import { AddressDetailsFormComponent } from '../../../../../core/components/address-details-form/address-details-form.component';
import { UserAddress, GeocodeResult } from '../../../../../core/models/address.model';

// Navigation state interface
interface AddressSelectorNavigationState {
  selectedLocation?: GeocodeResult;
  existingAddress?: UserAddress;
}

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
export class AddressesPage implements OnInit, OnDestroy, ViewWillEnter {
  private router = inject(Router);
  private addressService = inject(AddressService);
  private googleMapsService = inject(GoogleMapsService);
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
    // Initial load happens in ionViewWillEnter
  }

  ngOnDestroy() {
    // Cleanup if needed
  }

  ionViewWillEnter() {
    this.handleNavigationReturn();
    this.loadAddresses();
  }

  private async handleNavigationReturn() {
    const state = history.state as AddressSelectorNavigationState;

    if (state?.selectedLocation) {
      const location = state.selectedLocation;
      const existingAddress = state.existingAddress;
      history.replaceState({}, '');

      const validation = this.googleMapsService.validateLocation(location.lat, location.lng, location.address);
      if (!validation.valid) {
        await this.showToast(validation.error ?? 'Location outside service area.', 'warning');
        return;
      }

      await this.openAddressDetailsForm(location, existingAddress);
    }
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

  /**
   * Add new address - navigate to address-selector to pick location
   */
  addNewAddress() {
    this.router.navigate(['/c/address-selector'], {
      state: {
        returnUrl: '/c/profile/addresses',
        mode: 'create'
      }
    });
  }

  /**
   * Edit address - if location is invalid, navigate to map; otherwise open details form directly
   */
  async editAddress(address: UserAddress) {
    // If invalid location (0,0 or no valid location), auto-open map to fix
    if (!address.hasValidLocation || (address.location.lat === 0 && address.location.lng === 0)) {
      this.router.navigate(['/c/address-selector'], {
        state: {
          returnUrl: '/c/profile/addresses',
          mode: 'edit',
          existingAddress: address
        }
      });
      return;
    }

    // Valid location - open details form directly
    const location: GeocodeResult = {
      lat: address.location.lat,
      lng: address.location.lng,
      address: address.full_address
    };
    await this.openAddressDetailsForm(location, address);
  }

  /**
   * Open the address details form modal
   */
  private async openAddressDetailsForm(location: GeocodeResult, existingAddress?: UserAddress) {
    const modal = await this.modalController.create({
      component: AddressDetailsFormComponent,
      componentProps: {
        location,
        existingAddress
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.role === 'save') {
        // Reload addresses after save
        await this.loadAddresses();
      } else if (result.role === 'change-location') {
        // User wants to change location - navigate to map
        this.router.navigate(['/c/address-selector'], {
          state: {
            returnUrl: '/c/profile/addresses',
            mode: existingAddress ? 'edit' : 'create',
            existingAddress
          }
        });
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

  // Helper methods for template
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
