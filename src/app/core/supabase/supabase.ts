import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient, AuthError, AuthResponse, OAuthResponse, User, Session } from '@supabase/supabase-js';
import { Platform } from '@ionic/angular';
import { ConfigService } from '../config/config.service';
import { Database } from './database.types';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  error?: string;
}

export interface SignUpMetadata {
  full_name?: string;
  phone?: string;
  role?: 'customer' | 'provider' | 'admin';
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private _client: SupabaseClient<Database>;
  private configService = inject(ConfigService);
  private platform = inject(Platform);

  constructor() {
    const config = this.configService.supabase;
    this._client = createClient(config.url, config.key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-my-custom-header': 'after5x-app'
        }
      }
    });
  }

  get client(): SupabaseClient<Database> {
    return this._client;
  }

  // Email and Password Authentication
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await this._client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
        user: data.user ?? undefined,
        session: data.session ?? undefined,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  async signUpWithEmail(email: string, password: string, metadata?: SignUpMetadata): Promise<AuthResult> {
    try {
      const { data, error } = await this._client.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
        user: data.user ?? undefined,
        session: data.session ?? undefined,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // OTP Verification
  async verifyOtp(email: string, token: string, type: 'signup' | 'recovery' | 'email_change' = 'signup'): Promise<AuthResult> {
    try {
      const { data, error } = await this._client.auth.verifyOtp({
        email,
        token,
        type,
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
        user: data.user ?? undefined,
        session: data.session ?? undefined,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // Social Authentication
  async signInWithProvider(provider: 'google' | 'facebook'): Promise<AuthResult> {
    try {
      console.log(`Starting OAuth flow for ${provider}`);

      // Determine if we're running on a mobile platform
      const isMobile = this.isMobilePlatform();
      const config = this.configService.getConfig();

      // Force mobile detection for production builds to ensure proper redirect
      const forceMobile = config.production || isMobile;

      const redirectTo = forceMobile
        ? this.getMobileRedirectUrl()
        : `${window.location.origin}/auth/callback`;

      console.log('Redirect URL:', redirectTo);
      console.log('Is mobile:', isMobile);
      console.log('Platform details:', {
        allPlatforms: this.platform.platforms(),
        isCapacitor: this.platform.is('capacitor'),
        isHybrid: this.platform.is('hybrid'),
        isIOS: this.platform.is('ios'),
        isAndroid: this.platform.is('android'),
        isMobile: this.platform.is('mobile')
      });

      const oauthOptions = {
        provider,
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          // Skip nonce check for local development (required for some OAuth providers)
          skipBrowserRedirect: false
        },
      };

      console.log(`OAuth options for ${provider}:`, oauthOptions);

      const { data, error } = await this._client.auth.signInWithOAuth(oauthOptions);

      if (error) {
        console.error(`OAuth error for ${provider}:`, error);
        return this.handleAuthError(error);
      }

      console.log(`OAuth initiated successfully for ${provider}`);
      return {
        success: true,
      };
    } catch (error) {
      console.error(`OAuth exception for ${provider}:`, error);
      return this.handleAuthError(error as AuthError);
    }
  }

  private isMobilePlatform(): boolean {
    // Check if running in Capacitor (native mobile app)
    return this.platform.is('capacitor');
  }

  private getMobileRedirectUrl(): string {
    // For mobile apps, use the app scheme for deep linking
    const appScheme = 'com.rockit.after5'; // This should match your Capacitor appId
    return `${appScheme}://auth/callback`;
  }

  // Password Reset
  async resetPassword(email: string): Promise<AuthResult> {
    try {
      const { error } = await this._client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // Sign Out
  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await this._client.auth.signOut();

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // Resend OTP
  async resendOtp(email: string, type: 'signup' | 'email_change' = 'signup'): Promise<AuthResult> {
    try {
      const { error } = await this._client.auth.resend({
        type,
        email,
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return {
        success: true,
      };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // Get current session
  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data } = await this._client.auth.getSession();
      return data.session;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await this._client.auth.getUser();
      return data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  private handleAuthError(error: AuthError): AuthResult {
    console.error('Auth error:', error);

    let errorMessage = 'An unexpected error occurred. Please try again.';

    switch (error.message) {
      case 'Invalid login credentials':
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        break;
      case 'User already registered':
        errorMessage = 'An account with this email already exists. Please try logging in instead.';
        break;
      case 'Email not confirmed':
        errorMessage = 'Please check your email and click the confirmation link to complete your registration.';
        break;
      case 'Invalid email':
        errorMessage = 'Please enter a valid email address.';
        break;
      case 'Password should be at least 6 characters':
        errorMessage = 'Password must be at least 6 characters long.';
        break;
      case 'Token has expired or is invalid':
        errorMessage = 'The verification code has expired. Please request a new one.';
        break;
      case 'Invalid token':
        errorMessage = 'The verification code is invalid. Please check and try again.';
        break;
      case 'Too many requests':
        errorMessage = 'Too many attempts. Please wait a few minutes before trying again.';
        break;
      // OAuth-specific errors
      case 'OAuth provider not configured':
        errorMessage = 'Social login is not properly configured. Please contact support.';
        break;
      case 'OAuth callback error':
        errorMessage = 'There was an issue with the social login. Please try again.';
        break;
      case 'Invalid OAuth state':
        errorMessage = 'Social login session expired. Please try again.';
        break;
      default:
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('OAuth')) {
          errorMessage = 'Social login failed. Please try again or use email/password login.';
        }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}