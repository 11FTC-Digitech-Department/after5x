import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonBackButton,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  NavController
} from '@ionic/angular/standalone';
import { MapComponent } from '@core/components/map/map.component';
import { AddressService } from '@core/supabase/address.service';
import { UserAddress, GeocodeResult } from '@core/models/address.model';

@Component({
  selector: 'app-address-selector',
  templateUrl: './address-selector.page.html',
  styleUrls: ['./address-selector.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonBackButton,
    IonText,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    MapComponent
  ]
})
export class AddressSelectorPage implements OnInit {
  private navController = inject(NavController);
  private addressService = inject(AddressService);

  // State
  userAddresses = signal<UserAddress[]>([]);
  selectedLocation = signal<GeocodeResult | null>(null);
  isLoading = signal(true);
  showMap = signal(false);

  async ngOnInit() {
    await this.loadUserAddresses();
  }

  private async loadUserAddresses() {
    try {
      this.isLoading.set(true);
      const result = await this.addressService.getUserAddresses();
      if (result.error) {
        console.error('Error loading user addresses:', result.error);
      } else {
        this.userAddresses.set(result.data || []);
      }
    } catch (error) {
      console.error('Unexpected error loading user addresses:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectSavedAddress(address: UserAddress) {
    const location: GeocodeResult = {
      lat: address.location.lat,
      lng: address.location.lng,
      address: address.full_address
    };
    this.confirmSelection(location);
  }

  onLocationSelected(location: GeocodeResult) {
    this.selectedLocation.set(location);
  }

  openMapSelector() {
    this.showMap.set(true);
  }

  closeMapSelector() {
    this.showMap.set(false);
    this.selectedLocation.set(null);
  }

  confirmMapSelection() {
    const location = this.selectedLocation();
    if (location) {
      this.confirmSelection(location);
    }
  }

  private confirmSelection(location: GeocodeResult) {
    // Get the return URL from navigation state, or use default
    const state = history.state as { returnUrl?: string };
    const returnUrl = state?.returnUrl || '/c/book';

    // Navigate back with the selected location
    this.navController.navigateBack(returnUrl, {
      state: { selectedLocation: location }
    });
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

  getInitialMapLocation(): { lat: number; lng: number } | null {
    const defaultAddress = this.userAddresses().find(addr => addr.is_default);
    if (defaultAddress) {
      return { lat: defaultAddress.location.lat, lng: defaultAddress.location.lng };
    }
    return { lat: 14.5995, lng: 120.9842 }; // Manila default
  }

  getMapCenter(): { lat: number; lng: number; zoom?: number } {
    const defaultAddress = this.userAddresses().find(addr => addr.is_default);
    if (defaultAddress) {
      return { lat: defaultAddress.location.lat, lng: defaultAddress.location.lng, zoom: 15 };
    }
    return { lat: 14.5995, lng: 120.9842, zoom: 15 }; // Manila default
  }
}
