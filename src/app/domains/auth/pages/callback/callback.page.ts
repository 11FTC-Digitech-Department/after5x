import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { SessionService } from '../../../../core/auth/session';
import { OAuthHelperService } from '../../../../core/auth/oauth-helper.service';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { Session } from '@supabase/supabase-js';

@Component({
  selector: 'app-callback',
  templateUrl: './callback.page.html',
  styleUrls: ['./callback.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonSpinner,
    IonText,
    CommonModule
  ]
})
export class CallbackPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private toastController = inject(ToastController);
  private oauthHelper = inject(OAuthHelperService);

  isProcessing = signal<boolean>(true);
  statusMessage = signal<string>('Processing authentication...');

  ngOnInit() {
    this.handleAuthCallback();
  }

  private async handleAuthCallback() {
    try {
      console.log('OAuth callback initiated');

      // Check if user is already authenticated (page refresh after successful OAuth)
      if (this.sessionService.isAuthenticated()) {
        console.log('CallbackPage: User already authenticated, redirecting...');
        this.isProcessing.set(false);
        this.navigateBasedOnRole();
        return;
      }

      // Also check for existing session in storage (PKCE flow might have session but SessionService skipped loading it)
      try {
        const { data: existingSession } = await this.supabaseService.client.auth.getSession();
        if (existingSession.session) {
          console.log('CallbackPage: Found existing session in storage, redirecting...');
          await this.sessionService.setSession(existingSession.session);
          this.isProcessing.set(false);
          this.navigateBasedOnRole();
          return;
        }
      } catch (error) {
        console.log('CallbackPage: No existing session found, proceeding with OAuth flow');
      }

      console.log('URL details:', {
        href: window.location.href,
        hash: window.location.hash,
        search: window.location.search
      });

      // Combine parameters from route and URL
      const routeParams = this.route.snapshot.queryParams;
      const fragment = this.route.snapshot.fragment;
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      // Merge all sources
      const allParams: { [key: string]: string } = { ...routeParams };
      if (fragment) {
        const fragmentParams = new URLSearchParams(fragment);
        fragmentParams.forEach((value, key) => {
          allParams[key] = value;
        });
      }
      hashParams.forEach((value, key) => {
        allParams[key] = value;
      });

      console.log('Combined parameters:', Object.keys(allParams));

      // Check for OAuth errors
      const error = allParams['error'];
      const errorDescription = allParams['error_description'];

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        this.isProcessing.set(false);
        this.oauthHelper.notifyCallbackReceived(false, errorDescription || error);
        await this.showToast(
          this.getOAuthErrorMessage(error, errorDescription),
          'danger'
        );
        this.router.navigate(['/auth/login']);
        return;
      }

      // Check for OAuth code (PKCE flow) or direct tokens (legacy flow)
      const code = allParams['code'];
      const accessToken = allParams['access_token'];
      const refreshToken = allParams['refresh_token'];

      if (!code && (!accessToken || !refreshToken)) {
        console.error('No code or tokens in callback');
        this.isProcessing.set(false);
        this.oauthHelper.notifyCallbackReceived(false, 'No authentication code or tokens received');
        await this.showToast('Authentication failed: Invalid callback', 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      this.statusMessage.set('Completing authentication...');

      let setSessionError: any = null;

      if (code) {
        // Exchange authorization code for session (PKCE flow)
        console.log('CallbackPage: Exchanging authorization code for session');
        const { data, error } = await this.supabaseService.client.auth.exchangeCodeForSession(code);
        setSessionError = error;
        if (data?.session) {
          console.log('CallbackPage: Session obtained from code exchange');
        }
      } else {
        // Set session directly from tokens (legacy flow)
        console.log('CallbackPage: Setting session with OAuth tokens');
        const { error } = await this.supabaseService.client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        setSessionError = error;
      }

      if (setSessionError) {
        console.error('CallbackPage: Error setting session:', setSessionError);
        this.isProcessing.set(false);
        this.oauthHelper.notifyCallbackReceived(false, setSessionError.message);
        await this.showToast('Authentication failed: ' + setSessionError.message, 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      console.log('CallbackPage: Session set successfully, waiting for authentication...');

      // Poll SessionService's signal (no locks needed - signals are read-only)
      const maxAttempts = 30; // Increased from 20
      const delayMs = 200; // Reduced from 250ms for faster polling
      let authenticated = false;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isAuth = this.sessionService.isAuthenticated();
        const session = this.sessionService.session();

        console.log(`CallbackPage: Poll attempt ${attempt + 1}/${maxAttempts} - Authenticated: ${isAuth}, Session exists: ${!!session}`);

        if (isAuth && session) {
          authenticated = true;
          console.log(`CallbackPage: Authentication confirmed after ${attempt + 1} attempts`);
          console.log('CallbackPage: Session details:', {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: new Date(session.expires_at! * 1000)
          });
          break;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      if (authenticated) {
        this.statusMessage.set('Authentication successful!');
        this.isProcessing.set(false);
        this.oauthHelper.notifyCallbackReceived(true);

        // Clear URL parameters to prevent issues on refresh
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        window.history.replaceState({}, document.title, url.pathname);

        // Give SessionService time to fetch the profile
        setTimeout(() => this.navigateBasedOnRole(), 800);
      } else {
        console.error('CallbackPage: Timeout - session not established after', maxAttempts * delayMs, 'ms');

        // Fallback: Try to get session directly from Supabase
        console.log('CallbackPage: Attempting fallback session check...');
        try {
          const { data: sessionData, error: sessionError } = await this.supabaseService.client.auth.getSession();

          if (sessionError) {
            console.error('CallbackPage: Fallback session check failed:', sessionError);
          } else if (sessionData.session) {
            console.log('CallbackPage: Fallback session found, manually setting...');
            await this.sessionService.setSession(sessionData.session);

            this.statusMessage.set('Authentication successful!');
            this.isProcessing.set(false);
            this.oauthHelper.notifyCallbackReceived(true);

            // Clear URL parameters to prevent issues on refresh
            const url = new URL(window.location.href);
            url.search = '';
            url.hash = '';
            window.history.replaceState({}, document.title, url.pathname);

            setTimeout(() => this.navigateBasedOnRole(), 800);
            return;
          }
        } catch (fallbackError) {
          console.error('CallbackPage: Fallback failed:', fallbackError);
        }

        this.isProcessing.set(false);
        this.oauthHelper.notifyCallbackReceived(false, 'Session not established');
        await this.showToast('Authentication timeout. Please try again.', 'danger');
        this.router.navigate(['/auth/login']);
      }

    } catch (error) {
      console.error('Callback error:', error);
      this.isProcessing.set(false);
      this.oauthHelper.notifyCallbackReceived(false, String(error));
      await this.showToast('An unexpected error occurred', 'danger');
      this.router.navigate(['/auth/login']);
    }
  }

  private getOAuthErrorMessage(error: string, description?: string): string {
    const errorMessages: { [key: string]: string } = {
      'access_denied': 'You cancelled the login. Please try again if you want to sign in.',
      'server_error': 'The authentication service encountered an error. Please try again.',
      'temporarily_unavailable': 'The authentication service is temporarily unavailable. Please try again later.',
      'invalid_request': 'Invalid authentication request. Please try again.',
      'unauthorized_client': 'The app is not authorized for this login method. Please contact support.',
      'invalid_state': 'Your login session expired. Please try again.',
    };

    return errorMessages[error] || description || 'Authentication failed. Please try again.';
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  private navigateBasedOnRole() {
    const role = this.sessionService.userRole();
    switch (role) {
      case 'customer':
        this.router.navigate(['/c']);
        break;
      case 'provider':
        this.router.navigate(['/p']);
        break;
      case 'admin':
        this.router.navigate(['/admin']);
        break;
      default:
        this.router.navigate(['/c']); // Default to customer
    }
  }
}