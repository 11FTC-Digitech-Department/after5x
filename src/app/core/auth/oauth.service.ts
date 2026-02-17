import { Injectable, inject, signal } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Browser } from '@capacitor/browser';
import { devLog } from '../utils/logger';
import { SupabaseService } from '../supabase/supabase';
import { Provider, Session } from '@supabase/supabase-js';

export type OAuthProvider = 'google' | 'facebook';

export interface OAuthResult {
  success: boolean;
  error?: string;
  session?: Session | null;
}

@Injectable({
  providedIn: 'root'
})
export class OAuthService {
  private supabaseService = inject(SupabaseService);
  private platform = inject(Platform);

  /** Signal to track if OAuth callback is being processed */
  private _isProcessingCallback = signal<boolean>(false);
  readonly isProcessingCallback = this._isProcessingCallback.asReadonly();

  private get supabase() {
    return this.supabaseService.client;
  }

  /** Set the processing state (used by deep link handler) */
  setProcessingCallback(value: boolean): void {
    this._isProcessingCallback.set(value);
  }

  /**
   * Check if running on native mobile platform (Capacitor)
   */
  isNativePlatform(): boolean {
    return this.platform.is('capacitor');
  }

  /**
   * Get the appropriate redirect URL based on platform
   */
  private getRedirectUrl(): string {
    if (this.isNativePlatform()) {
      return 'after5://auth/callback';
    }
    return `${window.location.origin}/auth/callback`;
  }

  /**
   * Initiate OAuth sign-in flow with the specified provider
   */
  async signInWithProvider(provider: OAuthProvider): Promise<OAuthResult> {
    try {
      const redirectTo = this.getRedirectUrl();
      devLog(`OAuthService: Starting ${provider} OAuth flow, redirectTo:`, redirectTo);

      if (this.isNativePlatform()) {
        // Mobile flow: get OAuth URL and open in browser
        const { data, error } = await this.supabase.auth.signInWithOAuth({
          provider: provider as Provider,
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          }
        });

        if (error) {
          console.error('OAuth error:', error);
          return { success: false, error: error.message };
        }

        if (data.url) {
          // Open OAuth URL in in-app browser
          await Browser.open({
            url: data.url,
            presentationStyle: 'popover',
          });
        }

        return { success: true };
      } else {
        // Web flow: standard redirect
        const { error } = await this.supabase.auth.signInWithOAuth({
          provider: provider as Provider,
          options: {
            redirectTo,
          }
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      }
    } catch (error: unknown) {
      console.error('OAuth sign-in error:', error);
      const message = error instanceof Error ? error.message : 'OAuth sign-in failed';
      return { success: false, error: message };
    }
  }

  /**
   * Handle OAuth callback URL
   * Extracts authorization code and exchanges it for a session (PKCE flow)
   */
  async handleOAuthCallback(url: string): Promise<OAuthResult> {
    try {
      devLog('OAuthService: Handling callback URL:', url);

      // Parse the URL to extract parameters
      // Handle both deep link (after5://) and web URLs
      let parsedUrl: URL;
      try {
        if (url.startsWith('after5://')) {
          // Convert deep link to parseable URL
          parsedUrl = new URL(url.replace('after5://', 'https://placeholder/'));
        } else {
          parsedUrl = new URL(url);
        }
      } catch {
        return { success: false, error: 'Invalid callback URL' };
      }

      // Check for error in callback
      const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
      const queryParams = parsedUrl.searchParams;

      const error = hashParams.get('error') || queryParams.get('error');
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

      if (error) {
        console.error('OAuth callback error:', error, errorDescription);
        return { success: false, error: errorDescription || error };
      }

      // For PKCE flow, exchange the authorization code for a session
      const code = queryParams.get('code');
      if (code) {
        devLog('OAuthService: Exchanging authorization code for session...');
        const { data, error: exchangeError } = await this.supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('Code exchange error:', exchangeError);
          return { success: false, error: exchangeError.message };
        }

        devLog('OAuthService: Code exchange successful, session:', !!data.session);

        // Close the in-app browser after successful authentication
        await this.closeBrowser();

        // Verify session is set
        const { data: sessionData } = await this.supabase.auth.getSession();
        devLog('OAuthService: Verified session exists:', !!sessionData.session);

        return { success: true, session: sessionData.session };
      }

      // Check for access_token in hash (implicit flow fallback)
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken) {
        devLog('OAuthService: Setting session from tokens...');
        const { error: sessionError } = await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (sessionError) {
          return { success: false, error: sessionError.message };
        }

        await this.closeBrowser();

        return { success: true };
      }

      return { success: false, error: 'No authentication data in callback' };
    } catch (error: unknown) {
      console.error('OAuth callback handling error:', error);
      const message = error instanceof Error ? error.message : 'Failed to process OAuth callback';
      return { success: false, error: message };
    }
  }

  /**
   * Close the in-app browser (safe to call even if not open)
   */
  private async closeBrowser(): Promise<void> {
    try {
      await Browser.close();
    } catch {
      // Browser might already be closed or not supported on this platform
    }
  }
}
