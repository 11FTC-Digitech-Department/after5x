import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonSpinner,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../../../core/supabase/supabase';
import { SessionService } from '../../../../core/auth/session';

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
  private supabaseService = inject(SupabaseService);
  private sessionService = inject(SessionService);
  private toastController = inject(ToastController);

  isProcessing = signal<boolean>(true);
  statusMessage = signal<string>('Processing authentication...');

  ngOnInit() {
    this.handleAuthCallback();
  }

  private async handleAuthCallback() {
    try {
      console.log('OAuth callback initiated');
      console.log('Current URL:', window.location.href);
      console.log('URL hash:', window.location.hash);
      console.log('URL search:', window.location.search);

      // Check if we have OAuth parameters in the URL
      const hasAuthParams = window.location.hash.includes('access_token') ||
                           window.location.hash.includes('error') ||
                           window.location.search.includes('code') ||
                           window.location.search.includes('error');

      if (!hasAuthParams) {
        console.log('No OAuth parameters found in URL');
        // Try to get existing session in case user refreshed the page
        const { data, error } = await this.supabaseService.client.auth.getSession();

        if (data.session && !error) {
          console.log('Found existing session');
          this.statusMessage.set('Authentication successful!');
          setTimeout(() => {
            this.navigateBasedOnRole();
          }, 500);
          return;
        }

        console.log('No OAuth parameters and no existing session, redirecting to login');
        await this.showToast('Authentication failed: Invalid callback URL', 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      this.statusMessage.set('Completing authentication...');

      // Check for OAuth errors in URL
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = urlParams.get('error') || hashParams.get('error');
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        this.isProcessing.set(false);
        await this.showToast(`Authentication failed: ${errorDescription || error}`, 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      // Listen for auth state changes
      let authStateHandled = false;
      const { data: { subscription } } = this.supabaseService.client.auth.onAuthStateChange(async (event, session) => {
        if (authStateHandled) return; // Prevent duplicate handling
        authStateHandled = true;

        console.log('Auth state change:', event, session);

        // Clean up the listener
        subscription.unsubscribe();

        if (event === 'SIGNED_IN' && session) {
          console.log('User signed in via OAuth');
          this.statusMessage.set('Authentication successful!');
          this.isProcessing.set(false);

          // Wait a moment for session to be fully established
          setTimeout(() => {
            this.navigateBasedOnRole();
          }, 500);
        } else {
          console.log('OAuth authentication failed or no session');
          this.isProcessing.set(false);
          await this.showToast('Authentication failed. Please try again.', 'danger');
          this.router.navigate(['/auth/login']);
        }
      });

      // Also try to get session immediately in case it's already available
      const { data, error: sessionError } = await this.supabaseService.client.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        this.isProcessing.set(false);
        await this.showToast(`Authentication failed: ${sessionError.message}`, 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      if (data.session) {
        console.log('Session already available');
        this.statusMessage.set('Authentication successful!');
        this.isProcessing.set(false);
        setTimeout(() => {
          this.navigateBasedOnRole();
        }, 500);
        return;
      }

      // If no immediate session, wait for auth state change
      console.log('Waiting for OAuth session to be established...');

    } catch (error) {
      console.error('Callback handling error:', error);
      this.isProcessing.set(false);
      await this.showToast('An unexpected error occurred. Please try again.', 'danger');
      this.router.navigate(['/auth/login']);
    }
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