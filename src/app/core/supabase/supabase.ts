import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient, AuthError, User, Session } from '@supabase/supabase-js';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ConfigService, SupabaseConfig } from '../config/config.service';
import { Database } from './database.types';
import { CapacitorStorageAdapter } from '../storage/capacitor-storage.adapter';
import { devLog } from '../utils/logger';

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

interface NgrokPasswordSignInResponse {
  access_token: string;
  refresh_token: string;
  user?: User;
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private _client: SupabaseClient<Database>;
  private configService = inject(ConfigService);
  private storage = inject(CapacitorStorageAdapter);
  private supabaseConfig: SupabaseConfig;
  private useNativeNgrokAuth: boolean;

  constructor() {
    const config = this.configService.supabase;
    this.supabaseConfig = config;
    const isNgrokUrl = config.url.includes('ngrok');
    const capacitorPlatform = Capacitor.getPlatform();
    const isNativeCapacitorRuntime = Capacitor.isNativePlatform() || capacitorPlatform === 'android' || capacitorPlatform === 'ios';
    this.useNativeNgrokAuth = isNgrokUrl && isNativeCapacitorRuntime;

    // Avoid WebView/browser CORS preflight on ngrok free tunnels by routing
    // Supabase HTTP requests through Capacitor's native HTTP bridge.
    const globalOptions = this.useNativeNgrokAuth
      ? { fetch: this.nativeNgrokFetch.bind(this) as typeof fetch }
      : undefined;

    if (isNgrokUrl) {
      devLog('SupabaseService: ngrok mode', {
        url: config.url,
        capacitorPlatform,
        nativeFetchOverride: !!globalOptions,
        useNativeNgrokAuth: this.useNativeNgrokAuth,
      });
    }

    this._client = createClient(config.url, config.key, {
      ...(globalOptions && { global: globalOptions }),
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

  private async nativeNgrokFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = new Request(input, init);
    const method = request.method || 'GET';
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    headers['ngrok-skip-browser-warning'] = '1';
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'After5Native/1.0';
    }

    let data: unknown;
    if (method !== 'GET' && method !== 'HEAD') {
      const bodyText = await request.text();
      if (bodyText.length > 0) {
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(bodyText);
          } catch {
            data = bodyText;
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData: Record<string, string> = {};
          new URLSearchParams(bodyText).forEach((value, key) => {
            formData[key] = value;
          });
          data = formData;
        } else {
          data = bodyText;
        }
      }
    }

    const response = await CapacitorHttp.request({
      url: request.url,
      method,
      headers,
      ...(data !== undefined && { data }),
      responseType: 'text',
      connectTimeout: 30000,
      readTimeout: 30000,
    });

    const responseHeaders = new Headers();
    const nativeHeaders = (response.headers ?? {}) as Record<string, string | string[]>;
    for (const [key, value] of Object.entries(nativeHeaders)) {
      responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    }

    const responseBody = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data ?? null);

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  get client(): SupabaseClient<Database> {
    return this._client;
  }

  // Email and Password Authentication
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      if (this.useNativeNgrokAuth) {
        return await this.signInWithEmailViaNativeNgrok(email, password);
      }

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

  private async signInWithEmailViaNativeNgrok(email: string, password: string): Promise<AuthResult> {
    const authUrl = `${this.supabaseConfig.url}/auth/v1/token?grant_type=password`;
    const response = await CapacitorHttp.request({
      url: authUrl,
      method: 'POST',
      headers: {
        apikey: this.supabaseConfig.key,
        Authorization: `Bearer ${this.supabaseConfig.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'ngrok-skip-browser-warning': '1',
        'User-Agent': 'After5Native/1.0',
      },
      data: { email, password },
      responseType: 'text',
      connectTimeout: 30000,
      readTimeout: 30000,
    });

    const rawData = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data ?? null);

    let parsed: NgrokPasswordSignInResponse | null = null;
    try {
      parsed = JSON.parse(rawData) as NgrokPasswordSignInResponse;
    } catch {
      const normalizedRaw = rawData.toLowerCase();
      if (normalizedRaw.startsWith('this ngrok') || (normalizedRaw.includes('ngrok') && normalizedRaw.includes('<html'))) {
        return {
          success: false,
          error: 'Ngrok tunnel returned browser warning content instead of Supabase auth JSON.',
        };
      }
      return {
        success: false,
        error: 'Invalid response from authentication server.',
      };
    }

    if (response.status >= 400) {
      const authMessage = typeof parsed?.['msg'] === 'string'
        ? parsed['msg']
        : typeof parsed?.['message'] === 'string'
          ? parsed['message']
          : 'Authentication failed';
      return this.handleAuthError({ message: authMessage });
    }

    if (!parsed?.access_token || !parsed?.refresh_token) {
      return {
        success: false,
        error: 'Authentication response missing session tokens.',
      };
    }

    const { data, error } = await this._client.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });

    if (error) {
      return this.handleAuthError(error);
    }

    return {
      success: true,
      user: data.user ?? parsed.user ?? undefined,
      session: data.session ?? undefined,
    };
  }

  async signUpWithEmail(email: string, password: string, metadata?: SignUpMetadata): Promise<AuthResult> {
    try {
      const { data, error } = await this._client.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: 'https://app.after5.ph/auth/verify-email',
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
    const errorCode = error?.code || error?.error?.code || '';

    // Check error code first (more reliable)
    if (errorCode === 'over_email_send_rate_limit') {
      return {
        success: false,
        error: 'Email rate limit exceeded. Please wait a few minutes before trying again.',
      };
    }

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
        } else if (error?.code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
          errorMessage = 'Email rate limit exceeded. Please wait a few minutes before trying again.';
        }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
