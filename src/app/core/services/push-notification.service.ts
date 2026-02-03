import { Injectable, inject, signal, computed } from '@angular/core';
import { Platform } from '@ionic/angular';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { SupabaseService } from '../supabase/supabase';
import { Router } from '@angular/router';

/**
 * Notification preferences interface matching database schema
 * and existing UI settings pages
 */
export interface NotificationPreferences {
  // Master toggle
  push_enabled: boolean;

  // Customer preferences (customer app)
  booking_confirmed: boolean;
  booking_started: boolean;
  booking_completed: boolean;
  booking_cancelled: boolean;
  provider_on_way: boolean;
  provider_arrived: boolean;

  // Provider preferences (experts app)
  new_job: boolean;
  job_confirmed: boolean;
  job_cancelled: boolean;
  job_reminder: boolean;
  payment_received: boolean;
  payout_processed: boolean;
  verification_status: boolean;
  reviews: boolean;

  // Common preferences
  promotions: boolean;
  news_updates: boolean;
}

/**
 * Default preferences matching the UI defaults
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  // Customer
  booking_confirmed: true,
  booking_started: true,
  booking_completed: true,
  booking_cancelled: true,
  provider_on_way: true,
  provider_arrived: true,
  // Provider
  new_job: true,
  job_confirmed: true,
  job_cancelled: true,
  job_reminder: true,
  payment_received: true,
  payout_processed: true,
  verification_status: true,
  reviews: true,
  // Common
  promotions: false,
  news_updates: true,
};

/**
 * User context needed for push notification operations
 */
export interface PushNotificationUserContext {
  id: string;
  role: 'customer' | 'provider' | 'admin';
}

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private supabaseService = inject(SupabaseService);
  private platform = inject(Platform);
  private router = inject(Router);

  // User context is set externally to avoid circular dependency with SessionService
  private _userContext: PushNotificationUserContext | null = null;

  /**
   * Set user context - must be called before initialize()
   * This breaks the circular dependency with SessionService
   */
  setUserContext(context: PushNotificationUserContext | null): void {
    this._userContext = context;
  }

  // State signals
  private _permissionStatus = signal<'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown'>('unknown');
  private _fcmToken = signal<string | null>(null);
  private _preferences = signal<NotificationPreferences | null>(null);
  private _isInitialized = signal<boolean>(false);

  // Computed/readonly
  readonly permissionStatus = this._permissionStatus.asReadonly();
  readonly fcmToken = this._fcmToken.asReadonly();
  readonly preferences = this._preferences.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly isPushAvailable = computed(
    () => Capacitor.isNativePlatform() && (this.platform.is('ios') || this.platform.is('android'))
  );

  /**
   * Initialize push notifications - call after user authentication
   */
  async initialize(): Promise<void> {
    if (!this.isPushAvailable()) {
      console.log('PushNotificationService: Push not available on this platform');
      return;
    }

    if (this._isInitialized()) {
      console.log('PushNotificationService: Already initialized');
      return;
    }

    try {
      // Setup listeners first
      this.setupListeners();

      // Check current permission status
      const permStatus = await PushNotifications.checkPermissions();
      this._permissionStatus.set(permStatus.receive);

      // If already granted, register immediately
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      } else if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        // Request permission if not yet decided
        console.log('PushNotificationService: Requesting push notification permission');
        const requestResult = await PushNotifications.requestPermissions();
        this._permissionStatus.set(requestResult.receive);

        if (requestResult.receive === 'granted') {
          await PushNotifications.register();
        } else {
          console.log('PushNotificationService: Permission denied by user');
        }
      } else {
        console.log('PushNotificationService: Permission previously denied');
      }

      // Load user preferences
      await this.loadPreferences();

      this._isInitialized.set(true);
      console.log('PushNotificationService: Initialized successfully');
    } catch (error) {
      console.error('PushNotificationService: Initialization failed:', error);
    }
  }

  /**
   * Request push notification permission and register for FCM
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isPushAvailable()) {
      return false;
    }

    try {
      const permStatus = await PushNotifications.requestPermissions();
      this._permissionStatus.set(permStatus.receive);

      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }

      return false;
    } catch (error) {
      console.error('PushNotificationService: Permission request failed:', error);
      return false;
    }
  }

  /**
   * Setup Capacitor push notification listeners
   */
  private setupListeners(): void {
    // Token received
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log(
        'PushNotificationService: Token received:',
        token.value.substring(0, 20) + '...'
      );
      this._fcmToken.set(token.value);
      await this.saveTokenToServer(token.value);
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('PushNotificationService: Registration error:', error);
    });

    // Notification received while app is in foreground
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('PushNotificationService: Foreground notification:', notification);
        this.handleForegroundNotification(notification);
      }
    );

    // User tapped on notification (app was in background/closed)
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('PushNotificationService: Notification action:', action);
        this.handleNotificationAction(action);
      }
    );
  }

  /**
   * Save FCM token to Supabase
   */
  private async saveTokenToServer(token: string): Promise<void> {
    if (!this._userContext) {
      console.warn('PushNotificationService: No user context, cannot save token');
      return;
    }

    const client = this.supabaseService.client as any;
    const platform = this.platform.is('ios') ? 'ios' : 'android';
    const appType = this.getAppType();

    try {
      // Upsert token (insert or update if exists)
      const { error } = await client.from('device_tokens').upsert(
        {
          user_id: this._userContext.id,
          token: token,
          platform: platform,
          app_type: appType,
          is_active: true,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,token,app_type',
        }
      );

      if (error) {
        console.error('PushNotificationService: Failed to save token:', error);
      } else {
        console.log('PushNotificationService: Token saved successfully');
      }
    } catch (error) {
      console.error('PushNotificationService: Error saving token:', error);
    }
  }

  /**
   * Remove/deactivate token from server (on logout)
   */
  async removeTokenFromServer(): Promise<void> {
    const token = this._fcmToken();
    if (!token) return;

    const client = this.supabaseService.client as any;

    try {
      await client.from('device_tokens').update({ is_active: false }).eq('token', token);

      this._fcmToken.set(null);
      console.log('PushNotificationService: Token deactivated');
    } catch (error) {
      console.error('PushNotificationService: Error removing token:', error);
    }
  }

  /**
   * Handle foreground notification - emit event for in-app display
   */
  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // Emit custom event for components to listen to
    const customEvent = new CustomEvent('pushNotificationReceived', {
      detail: {
        title: notification.title,
        body: notification.body,
        data: notification.data,
      },
    });
    window.dispatchEvent(customEvent);
  }

  /**
   * Handle notification tap - navigate to appropriate screen
   */
  private handleNotificationAction(action: ActionPerformed): void {
    const data = action.notification.data;

    if (data?.booking_id) {
      // Navigate to booking details based on user role
      const role = this._userContext?.role;
      if (role === 'provider') {
        this.router.navigate(['/p/bookings', data.booking_id]);
      } else {
        this.router.navigate(['/c/bookings', data.booking_id]);
      }
    } else if (data?.route) {
      // Custom route specified in notification
      this.router.navigateByUrl(data.route);
    }
  }

  /**
   * Get app type (customer or experts) based on user role
   */
  private getAppType(): 'customer' | 'experts' {
    const role = this._userContext?.role;
    return role === 'provider' ? 'experts' : 'customer';
  }

  /**
   * Load user notification preferences from server
   */
  async loadPreferences(): Promise<void> {
    if (!this._userContext) return;

    const client = this.supabaseService.client as any;

    try {
      const { data, error } = await client.rpc('get_or_create_notification_preferences', {
        p_user_id: this._userContext.id,
      });

      if (error) {
        console.error('PushNotificationService: Failed to load preferences:', error);
        // Use defaults on error
        this._preferences.set({ ...DEFAULT_PREFERENCES });
        return;
      }

      this._preferences.set(data as NotificationPreferences);
    } catch (error) {
      console.error('PushNotificationService: Error loading preferences:', error);
      // Use defaults on error
      this._preferences.set({ ...DEFAULT_PREFERENCES });
    }
  }

  /**
   * Update notification preferences on server
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<boolean> {
    if (!this._userContext) return false;

    const client = this.supabaseService.client as any;

    try {
      const { error } = await client
        .from('notification_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this._userContext.id);

      if (error) {
        console.error('PushNotificationService: Failed to update preferences:', error);
        return false;
      }

      // Update local state
      const current = this._preferences();
      if (current) {
        this._preferences.set({ ...current, ...updates });
      }

      return true;
    } catch (error) {
      console.error('PushNotificationService: Error updating preferences:', error);
      return false;
    }
  }

  /**
   * Update a single preference
   */
  async updatePreference(key: keyof NotificationPreferences, value: boolean): Promise<boolean> {
    return this.updatePreferences({ [key]: value });
  }

  /**
   * Get a specific preference value
   */
  getPreference(key: keyof NotificationPreferences): boolean {
    const prefs = this._preferences();
    if (!prefs) return DEFAULT_PREFERENCES[key];
    return prefs[key];
  }

  /**
   * Cleanup on logout
   */
  async cleanup(): Promise<void> {
    await this.removeTokenFromServer();
    this._preferences.set(null);
    this._isInitialized.set(false);
    this._fcmToken.set(null);
    this._userContext = null;
  }

  /**
   * Remove all listeners (call on app destroy if needed)
   */
  async removeListeners(): Promise<void> {
    await PushNotifications.removeAllListeners();
  }
}
