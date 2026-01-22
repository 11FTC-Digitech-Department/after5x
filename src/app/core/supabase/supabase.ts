import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient, AuthError, User, Session } from '@supabase/supabase-js';
import { Platform } from '@ionic/angular';
import { ConfigService } from '../config/config.service';
import { Database } from './database.types';
import { CapacitorStorageAdapter } from '../storage/capacitor-storage.adapter';

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
  private storage = inject(CapacitorStorageAdapter);

  constructor() {
    const config = this.configService.supabase;

    this._client = createClient(config.url, config.key, {
      auth: {
        storage: this.storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,  // Disable automatic session detection from URL
        flowType: 'pkce',
        // Disable Navigator Lock to prevent NavigatorLockAcquireTimeoutError
        // This no-op lock function bypasses the browser's LockManager API
        // Safe because we use custom storage adapter with proper async handling
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
          // Directly execute the function without acquiring a lock
          return await fn();
        }
      },
      db: {
        schema: 'public'
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

  // Phone OTP - Send verification code
  async signInWithPhone(phone: string): Promise<AuthResult> {
    try {
      const { error } = await this._client.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms'
        }
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return { success: true };
    } catch (error) {
      return this.handleAuthError(error as AuthError);
    }
  }

  // Phone OTP - Verify code and create session
  async verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
    try {
      const { data, error } = await this._client.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
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

  // Update phone number with verification
  async updatePhoneNumber(phone: string): Promise<AuthResult> {
    try {
      const { error } = await this._client.auth.updateUser({
        phone
      });

      if (error) {
        return this.handleAuthError(error);
      }

      return { success: true };
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

  private handleAuthError(error: any): AuthResult {
    console.error('Auth error:', error);

    let errorMessage = 'An unexpected error occurred. Please try again.';

    // Handle different error object structures
    const message = error?.message || error?.error?.message || error?.msg || '';

    switch (message) {
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
      default:
        if (message.includes('Network request failed')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error?.code === 'user_already_exists') {
          errorMessage = 'An account with this email already exists. Please try logging in instead.';
        }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}