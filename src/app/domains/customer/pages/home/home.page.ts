import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonBadge
} from '@ionic/angular/standalone';
import { AddressService } from '@core/supabase/address.service';
import { SessionService } from '@core/auth/session';

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface PopularService {
  id: string;
  title: string;
  price: number;
  rating: number;
  provider: string;
  image: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardTitle,
    IonCardContent,
    IonText,
    IonBadge,
    CommonModule,
    FormsModule
  ]
})
export class HomePage implements OnInit {
  private addressService = inject(AddressService);
  private router = inject(Router);
  private sessionService = inject(SessionService);

  // Track if initial data load happened (prevents duplicate loads from effect)
  private dataLoaded = signal(false);

  userName = computed(() => {
    const profile = this.sessionService.profile();
    return profile?.full_name || 'User';
  });

  currentLocation = signal('Select your location');

  categories: ServiceCategory[] = [
    { id: '1', name: 'Locksmithing', slug: 'locksmithing', icon: 'key' },
    { id: '2', name: 'Aircon', slug: 'aircon', icon: 'snow' },
    { id: '3', name: 'Electrical', slug: 'electrical', icon: 'flash' },
    { id: '4', name: 'Automotive', slug: 'automotive', icon: 'car' },
    { id: '5', name: 'Plumbing', slug: 'plumbing', icon: 'water' }
  ];

  // Note: These popular services are hardcoded for demo.
  // In production, these would come from a "featured" or "popular" query

  popularServices: PopularService[] = [
    {
      id: '1',
      title: 'AC Regular Cleaning',
      price: 1200,
      rating: 4.8,
      provider: 'Teko PH',
      image: 'assets/splash/main-splash.png'
    },
    {
      id: '2',
      title: 'Home Lockout',
      price: 800,
      rating: 4.9,
      provider: 'Masterlock PH',
      image: 'assets/splash/main-splash.png'
    },
    {
      id: '3',
      title: 'Battery Jumpstart',
      price: 1500,
      rating: 4.7,
      provider: 'KMAce Auto',
      image: 'assets/splash/main-splash.png'
    }
  ];

  constructor() {
    // Reactive effect: load data when profile becomes available
    // This handles the case where profile loads after ngOnInit
    effect(() => {
      const profile = this.sessionService.profile();
      const isLoading = this.sessionService.isLoading();

      // Only trigger if we have profile, session is not loading, and haven't loaded data yet
      if (profile?.id && !isLoading && !this.dataLoaded()) {
        this.loadDefaultAddress();
      }
    });
  }

  async ngOnInit() {
    // Fast path: if profile is already available, load immediately
    // Otherwise, the effect will trigger when profile becomes available
    if (this.sessionService.profile()?.id) {
      await this.loadDefaultAddress();
    }
  }

  async loadDefaultAddress() {
    // Mark as loaded to prevent duplicate loads from effect
    this.dataLoaded.set(true);

    try {
      const result = await this.addressService.getDefaultAddress();
      if (result.data) {
        // Show a shortened version of the address
        const address = result.data.full_address;
        const maxLength = 35;
        const displayAddress = address.length > maxLength
          ? address.substring(0, maxLength) + '...'
          : address;
        this.currentLocation.set(displayAddress);
      } else {
        // No default address set, keep the prompt
        this.currentLocation.set('Select your location');
      }
    } catch (error) {
      console.error('Error loading default address:', error);
      this.currentLocation.set('Select your location');
    }
  }

  navigateToAddresses() {
    this.router.navigate(['/c/profile/addresses']);
  }

  navigateToCategory(category: ServiceCategory) {
    this.router.navigate(['/c/catalog', category.slug]);
  }

  navigateToService(service: PopularService) {
    // For now, navigate to catalog with a default category
    // In production, this would navigate to specific service details
    this.router.navigate(['/c/catalog', 'plumbing']); // Default to first category
  }
}
