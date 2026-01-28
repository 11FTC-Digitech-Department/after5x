import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase';
import { User, Session } from '@supabase/supabase-js';
import { BiometricService } from './biometric.service';
import { AuthFlowService } from './auth-flow.service';
import { AuthEventsService } from './auth-events.service';
import { AUTH_CONFIG } from './auth.config';
import { ToastController } from '@ionic/angular/standalone';
import { PaymentContextService } from '../services/payment-context.service';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'customer' | 'provider' | 'admin';
  activated: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private supabase = inject(SupabaseService).client;
  private router = inject(Router);
  private biometricService = inject(BiometricService);
  private authFlowService = inject(AuthFlowService);
  private authEventsService = inject(AuthEventsService);
  private toastController = inject(ToastController);
  private paymentContextService = inject(PaymentContextService);

  // --- STATE (Signals) ---
  private _session = signal<Session | null>(null);
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal<boolean>(true);
  private _initialized = signal<boolean>(false);
  private _isSignupInProgress = signal<boolean>(false);

  // --- COMPUTED (Read-only) ---
  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isLoading = this._loading.asReadonly();
  readonly isSignupInProgress = this._isSignupInProgress.asReadonly();
  
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
        // Fetch profile with timeout - loading stays true until this completes
        try {
          await this.fetchProfileWithTimeout(data.session.user.id);
        } catch (error) {
          console.error('SessionService: Initial profile fetch failed:', error);
          // Continue - profile may be retried later
        }
      }
    } catch (error) {
      console.error('Error during session initialization:', error);
      this._session.set(null);
      this._profile.set(null);
    } finally {
      // Only set loading false AFTER profile is resolved (or no session)
      this._loading.set(false);
      this._initialized.set(true);
    }

    // Setup listener AFTER initialization is complete
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('SessionService: Auth state changed:', event, 'session:', !!session);
      const wasAuthenticated = !!this._session();

      if (session) {
        // Always update the session
        this._session.set(session);

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          // Check if signup is in progress - skip auto-navigation
          console.log('SessionService: SIGNED_IN event, signup flag:', this._isSignupInProgress());
          if (this._isSignupInProgress() && event === 'SIGNED_IN') {
            console.log('SessionService: Signup in progress - skipping auto-navigation');
            // Still fetch profile but don't navigate
            this.fetchProfile(session.user.id).catch(err =>
              console.warn('SessionService: Background profile fetch during signup failed:', err)
            );
            return;
          }
          
          // Check if returning from payment flow - skip blocking fetch
          if (this.paymentContextService.isInPaymentFlow()) {
            console.log('SessionService: Returning from payment flow - background profile fetch');
            this.fetchProfile(session.user.id).catch(err =>
              console.warn('SessionService: Background profile refresh failed:', err)
            );
            this.paymentContextService.exitPaymentFlow();
          } else {
            // Normal sign in - block UI while loading profile
            this._loading.set(true);
            try {
              await this.fetchProfileWithTimeout(session.user.id);
              console.log('SessionService: Profile loaded successfully for event:', event);
              // Emit session started event
              this.authEventsService.emit('SESSION_STARTED', session.user.id);
              // Navigation is handled by the calling component (LoginPage, etc.)
              // Skip navigation if signup is in progress
              if (this._isSignupInProgress() && event === 'SIGNED_IN') {
                console.log('SessionService: Skipping navigation - signup in progress');
              }
            } catch (error) {
              console.error('SessionService: Error fetching profile during auth state change:', error);
              // Don't clear the session on profile fetch error - profile might load on retry
            } finally {
              this._loading.set(false);
            }
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token refresh - update silently WITHOUT blocking UI
          console.log('SessionService: Token refreshed silently, updating profile in background');
          this.authEventsService.emit('SESSION_REFRESHED', session.user.id);
          // Refresh profile in background without setting loading state
          this.fetchProfile(session.user.id).catch(err =>
            console.warn('SessionService: Silent profile refresh failed:', err)
          );
        }
      } else {
        this._session.set(null);
        this._profile.set(null);
        this._loading.set(false);

        // Handle different logout scenarios
        if (wasAuthenticated && this._initialized()) {
          if (event === 'SIGNED_OUT') {
            // Manual logout - navigate to welcome
            console.log('SessionService: Manual logout - navigating to welcome page');
            this.authEventsService.emit('SIGNED_OUT');
            this.router.navigateByUrl('/auth/welcome');
          } else {
            // Session expired or token became invalid
            console.log('SessionService: Session expired - handling redirect');
            this.authEventsService.emit('SESSION_EXPIRED');
            await this.handleSessionExpiry();
          }
        }
      }
    });
  }

  /**
   * Fetch profile with timeout to prevent indefinite hangs.
   * Uses the configured timeout from AUTH_CONFIG.
   */
  private async fetchProfileWithTimeout(userId: string): Promise<void> {
    const timeoutMs = AUTH_CONFIG.session.profileLoadTimeoutMs;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Profile fetch timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([
      this.fetchProfile(userId),
      timeoutPromise
    ]);
  }

  private async fetchProfile(userId: string) {
    try {
      console.log('SessionService: Fetching profile for user:', userId);
      
      // Try to fetch with activated column first
      const result = await this.supabase
        .from('profiles')
        .select('id, email, full_name, role, activated')
        .eq('id', userId)
        .maybeSingle();

      let data: UserProfile | null = result.data as UserProfile | null;
      let error = result.error;

      // If activated column doesn't exist, fallback to query without it
      if (error && typeof error === 'object' && 'message' in error && 
          typeof error.message === 'string' && error.message.includes("column 'activated' does not exist")) {
        console.warn('SessionService: activated column not found, fetching without it');
        const fallbackResult = await this.supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('id', userId)
          .maybeSingle();
        
        error = fallbackResult.error;
        
        // Add default activated value if column doesn't exist
        if (fallbackResult.data) {
          data = {
            ...fallbackResult.data,
            activated: true // Default to activated if column doesn't exist
          } as UserProfile;
        } else {
          data = null;
        }
      }

      if (error) {
        console.error('SessionService: Error fetching profile:', error);
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      if (data) {
        this._profile.set(data as UserProfile);
        console.log('SessionService: Profile set successfully, role:', (data as any).role);
      } else {
        console.warn('SessionService: Profile not found for user:', userId);
        // Try to create profile for OAuth users
        await this.createProfileIfNeeded(userId);
      }
    } catch (error) {
      console.error('SessionService: Unexpected error fetching profile:', error);
      throw error; // Re-throw to be handled by caller
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

      // Get role from metadata or default to customer
      const userRole = (user.user_metadata?.['role'] || 'customer') as 'customer' | 'provider' | 'admin';
      
      // Set activated based on role - all roles activated except provider
      const activated = userRole !== 'provider';

      // Create profile for new user
      const profileData = {
        id: userId,
        email: user.email || '',
        full_name: this.extractFullName(user),
        role: userRole,
        activated: activated,
        phone_number: user.user_metadata?.['phone'] || user.phone || null,
        avatar_url: user.user_metadata?.['avatar_url'] || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Create profile
      const { error: profileError } = await this.supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return;
      }

      // Create customer record if role is customer
      if (profileData.role === 'customer') {
        const customerData = {
          id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: customerError } = await this.supabase
          .from('customers')
          .insert(customerData);

        if (customerError) {
          console.error('Error creating customer record:', customerError);
          // Don't return here - profile was created successfully
        } else {
          console.log('Customer record created successfully for user:', userId);
        }
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

        // Navigate to preserved URL or role-based default, but skip if signup is in progress
        if (!this._isSignupInProgress()) {
          await this.authFlowService.navigateAfterAuthentication(this.userRole());
        } else {
          console.log('SessionService: Skipping navigation - signup in progress');
        }
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

  /**
   * Set signup in-progress flag to prevent auto-navigation during signup flow
   */
  setSignupInProgress(value: boolean): void {
    this._isSignupInProgress.set(value);
  }
}