import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { devError } from '../../../../core/utils/logger';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  IonBadge,
  IonList,
  IonListHeader,
  IonLabel
} from '@ionic/angular/standalone';
import { AddressService } from '@core/supabase/address.service';
import { SessionService } from '@core/auth/session';
import { AuthFlowService } from '@core/auth/auth-flow.service';
import { NotificationService } from '@core/services/notification.service';
import { SupabaseService } from '@core/supabase/supabase';

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
  /** Category slug for catalog navigation (e.g. aircon, locksmithing, automotive) */
  categorySlug: string;
}

interface HomeOffer {
  id: string;
  title: string;
  description: string;
  badge_text: string | null;
  image_url: string | null;
  voucher_code: string | null;
  note: string | null;
  discount_label: string | null;
  discount_condition: string | null;
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
    FormsModule,
    IonList,
    IonListHeader,
    IonLabel,
    RouterLink
  ]
})
export class HomePage implements OnInit {
  private addressService = inject(AddressService);
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);
  private notificationService = inject(NotificationService);
  private supabaseService = inject(SupabaseService);

  // Track if initial data load happened (prevents duplicate loads from effect)
  private dataLoaded = signal(false);

  userName = computed(() => {
    const profile = this.sessionService.profile();
    return profile?.full_name || 'Guest';
  });

  isAuthenticated = computed(() => this.sessionService.isAuthenticated());

  currentLocation = signal('Select your location');

  /** Unread count from NotificationService (single source of truth with tab bar). */
  unreadNotificationCount = this.notificationService.unreadCount;

  categories: ServiceCategory[] = [
    { id: '1', name: 'Locksmithing', slug: 'locksmithing', icon: 'key' },
    { id: '2', name: 'Aircon', slug: 'aircon', icon: 'snow' },
    { id: '3', name: 'Electrical', slug: 'electrical', icon: 'flash' },
    { id: '4', name: 'Roadside Assistance', slug: 'automotive', icon: 'car' },
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
      image: 'assets/splash/main-splash.png',
      categorySlug: 'aircon'
    },
    {
      id: '2',
      title: 'Home Lockout',
      price: 800,
      rating: 4.9,
      provider: 'Masterlock PH',
      image: 'assets/splash/main-splash.png',
      categorySlug: 'locksmithing'
    },
    {
      id: '3',
      title: 'Battery Jumpstart',
      price: 1500,
      rating: 4.7,
      provider: 'KMAce Auto',
      image: 'assets/splash/main-splash.png',
      categorySlug: 'automotive'
    }
  ];

  offers = signal<HomeOffer[]>([]);

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

    await this.loadOffers();
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
      devError('Error loading default address:', error);
      this.currentLocation.set('Select your location');
    }
  }

  async loadOffers() {
    try {
      const now = new Date();
      const client = this.supabaseService.client as any;
      const { data, error } = await client
        .from('offers')
        .select('id, title, description, badge_text, image_url, voucher_code, note, discount_label, discount_condition, sort_order, created_at, starts_at, ends_at')
        .eq('status', 'active')
        .in('target_role', ['customer', 'all'])
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load offers:', error);
        return;
      }

      const filtered = (data || []).filter((offer: any) => {
        const startsAt = offer.starts_at ? new Date(offer.starts_at) : null;
        const endsAt = offer.ends_at ? new Date(offer.ends_at) : null;
        const started = !startsAt || startsAt <= now;
        const notEnded = !endsAt || endsAt >= now;
        return started && notEnded;
      });

      this.offers.set(filtered as unknown as HomeOffer[]);
    } catch (err) {
      console.error('Failed to load offers:', err);
    }
  }

  navigateToAddresses() {
    if (!this.isAuthenticated()) {
      void this.authFlowService.handleAuthRequired(this.router.url, 'authentication_required');
      return;
    }

    this.router.navigate(['/c/profile/addresses']);
  }

  navigateToCategory(category: ServiceCategory) {
    this.router.navigate(['/c/catalog', category.slug]);
  }

  navigateToCategories() {
    this.router.navigate(['/c/categories']);
  }

  navigateToAuth(tab: 'login' | 'signup') {
    this.router.navigate(['/auth/login'], { queryParams: { tab } });
  }

  navigateToService(service: PopularService) {
    this.router.navigate(['/c/catalog', service.categorySlug]);
  }

  navigateToNotifications() {
    if (!this.isAuthenticated()) {
      void this.authFlowService.handleAuthRequired(this.router.url, 'authentication_required');
      return;
    }

    this.router.navigate(['/c/notifications']);
  }
}
