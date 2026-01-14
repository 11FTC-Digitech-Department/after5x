import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase';
import { User, Session } from '@supabase/supabase-js';
import { BiometricService } from './biometric.service';
import { AuthFlowService } from './auth-flow.service';
import { ToastController } from '@ionic/angular/standalone';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'provider' | 'admin';
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);
  private biometricService = inject(BiometricService);
  private authFlowService = inject(AuthFlowService);
  private toastController = inject(ToastController);

  // --- STATE (Signals) ---
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal<boolean>(true);
  private _initialized = signal<boolean>(false);

  // --- COMPUTED (Read-only) ---
  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isLoading = this._loading.asReadonly();
  
  readonly isAuthenticated = computed(() => !!this._session());
  readonly isFullyAuthenticated = computed(() => !!this._session() && !!this._profile());
  readonly userRole = computed(() => this._profile()?.role);

  constructor() {
    this.initSession();
  }

  private async initSession() {
    this._loading.set(true);

    try {
      console.log('SessionService: Getting initial session');
      const { data, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
      }

      this._session.set(data.session);

      if (data.session) {
        await this.fetchProfile(data.session.user.id);
      }
    } catch (error) {
      console.error('Error during session initialization:', error);
    }

    this._loading.set(false);
    this._initialized.set(true);

    // 2. Listen for changes (Login/Logout)
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('SessionService: Auth state changed:', event, 'session:', !!session);
      const wasAuthenticated = !!this._session();
      this._session.set(session);

      if (session) {
        await this.fetchProfile(session.user.id);
      } else {
        this._profile.set(null);
        // Handle different logout scenarios
        if (wasAuthenticated && this._initialized()) {
          if (event === 'SIGNED_OUT') {
            // Manual logout - navigate to welcome
            console.log('SessionService: Manual logout - navigating to welcome page');
            this.router.navigateByUrl('/auth/welcome');
          } else {
            // Session expired or token became invalid
            console.log('SessionService: Session expired - handling redirect');
            await this.handleSessionExpiry();
          }
        }
      }
    });
  }

  private async fetchProfile(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        this._profile.set(data as UserProfile);
      } else {
        console.warn('Profile not found for user:', userId);
        // Try to create profile for OAuth users
        await this.createProfileIfNeeded(userId);
      }
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  }

  private async createProfileIfNeeded(userId: string) {
    try {
      // Get current user info
      const { data: userData, error: userError } = await this.supabase.auth.getUser();

      if (userError || !userData.user) {
        console.error('Error getting user data:', userError);
        return;
      }

      const user = userData.user;

      // Check if profile exists again (race condition protection)
      const { data: existingProfile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        await this.fetchProfile(userId);
        return;
      }

      // Create profile for new user
      const profileData = {
        id: userId,
        email: user.email || '',
        full_name: this.extractFullName(user),
        role: 'customer' as const, // Default role
        phone_number: user.user_metadata?.['phone'] || user.phone || null,
        avatar_url: user.user_metadata?.['avatar_url'] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await this.supabase
        .from('profiles')
        .insert(profileData);

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return;
      }

      console.log('Profile created successfully for user:', userId);
      this._profile.set(profileData as UserProfile);

    } catch (error) {
      console.error('Error creating profile for user:', error);
    }
  }

  private extractFullName(user: User): string {
    // Try different sources for the full name
    if (user.user_metadata?.['full_name']) {
      return user.user_metadata['full_name'];
    }
    if (user.user_metadata?.['name']) {
      return user.user_metadata['name'];
    }
    if (user.user_metadata?.['first_name'] && user.user_metadata?.['last_name']) {
      return `${user.user_metadata['first_name']} ${user.user_metadata['last_name']}`;
    }
    // Fallback to email username
    return user.email?.split('@')[0] || 'User';
  }

  async setSession(session: Session) {
    this._session.set(session);
    await this.fetchProfile(session.user.id);
  }

  async signOut() {
    const wasAuthenticated = !!this._session();

    try {
      console.log('SessionService: Attempting to sign out...');

      // Attempt to sign out from Supabase
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        console.warn('SessionService: Supabase signOut error (likely expired session):', error);
        // Continue with force logout even if server logout fails
      }

      // Force clear local session state regardless of server response
      console.log('SessionService: Force clearing local session state');
      this._session.set(null);
      this._profile.set(null);

      // Clean up biometric credentials if enabled
      if (this.biometricService.isBiometricEnabled()) {
        console.log('SessionService: Disabling biometric login during logout');
        await this.biometricService.disableBiometric();
      }

      // Navigate to welcome page if user was authenticated
      if (wasAuthenticated && this._initialized()) {
        console.log('SessionService: Manual logout - navigating to welcome page');
        await this.authFlowService.handleAuthRequired('', 'manual_logout');
      }

    } catch (error) {
      console.error('SessionService: Unexpected error during signOut:', error);

      // Even on unexpected errors, force clear local state and navigate
      this._session.set(null);
      this._profile.set(null);

      // Force navigation as fallback
      if (this._initialized()) {
        await this.authFlowService.handleAuthRequired('', 'manual_logout');
      }
    }
  }

  /**
   * Handle session expiry by showing notification and preserving current URL.
   */
  private async handleSessionExpiry(): Promise<void> {
    const currentUrl = this.router.url;

    // Show session expiry notification
    const toast = await this.toastController.create({
      message: 'Your session has expired. Please log in again.',
      duration: 4000,
      color: 'warning',
      position: 'top',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await toast.present();

    // Preserve current location and redirect to login
    await this.authFlowService.handleAuthRequired(currentUrl, 'session_expired');
  }

  // --- BIOMETRIC AUTHENTICATION ---

  /**
   * Enable biometric login for the current session
   * Stores the refresh token securely for future biometric authentication
   */
  async enableBiometricForCurrentSession(): Promise<boolean> {
    const session = this._session();
    if (!session?.refresh_token) {
      console.warn('SessionService: No session or refresh token available for biometric');
      return false;
    }

    const result = await this.biometricService.enableBiometric(session.refresh_token);
    return result.success;
  }

  /**
   * Login using biometric authentication
   * Retrieves stored refresh token and creates new session
   */
  async loginWithBiometric(): Promise<{ success: boolean; error?: string }> {
    if (!this.biometricService.isBiometricEnabled()) {
      return { success: false, error: 'Biometric login not enabled' };
    }

    const result = await this.biometricService.authenticateWithBiometric();

    if (result.success) {
      // Session was refreshed by biometric service, get updated session
      const { data } = await this.supabase.auth.getSession();
      if (data.session) {
        this._session.set(data.session);
        await this.fetchProfile(data.session.user.id);

        // Navigate to preserved URL or role-based default
        await this.authFlowService.navigateAfterAuthentication(this.userRole());
      }
    }

    return result;
  }

  /**
   * Disable biometric login
   */
  async disableBiometric(): Promise<boolean> {
    const result = await this.biometricService.disableBiometric();
    return result.success;
  }

  /**
   * Check if biometric login is available on this device
   */
  get canUseBiometric(): boolean {
    return this.biometricService.isBiometricAvailable();
  }

  /**
   * Check if biometric login is enabled for this user
   */
  get isBiometricEnabled(): boolean {
    return this.biometricService.isBiometricEnabled();
  }

  /**
   * Get the biometry type name (Face ID, Touch ID, etc.)
   */
  get biometryTypeName(): string {
    return this.biometricService.getBiometryTypeName();
  }
}