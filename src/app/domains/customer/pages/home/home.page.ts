import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
import { SupabaseService } from '@core/supabase/supabase';
import { AddressService } from '@core/supabase/address.service';
import { User } from '@supabase/supabase-js';

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
  private supabaseService = inject(SupabaseService);
  private addressService = inject(AddressService);
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  userName = computed(() => {
    const user = this.currentUser();
    return user?.user_metadata?.['full_name'] || user?.email?.split('@')[0] || 'User';
  });

  currentLocation = signal('Select your location');

  categories: ServiceCategory[] = [
    { id: '1', name: 'Locksmithing', slug: 'locksmithing', icon: 'key' },
    { id: '2', name: 'Aircon', slug: 'aircon', icon: 'snow' },
    { id: '3', name: 'Electrical', slug: 'electrical', icon: 'flash' },
    { id: '4', name: 'Automotive', slug: 'automotive', icon: 'car' },
    { id: '5', name: 'Plumbing', slug: 'plumbing', icon: 'water' }
  ];

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

  constructor() { }

  async ngOnInit() {
    await this.loadUser();
    await this.loadDefaultAddress();
  }

  async loadUser() {
    try {
      const user = await this.supabaseService.getCurrentUser();
      this.currentUser.set(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }

  async loadDefaultAddress() {
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
    // Navigate to service details or booking
    this.router.navigate(['/c/book', service.id]);
  }
}
