import { Component, OnInit, inject } from '@angular/core';
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

  ngOnInit() {
    this.handleAuthCallback();
  }

  private async handleAuthCallback() {
    try {
      console.log('OAuth callback initiated');
      console.log('Current URL:', window.location.href);

      // Get the current session from Supabase
      const { data, error } = await this.supabaseService.client.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        console.error('Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        await this.showToast(`Authentication failed: ${error.message}`, 'danger');
        this.router.navigate(['/auth/login']);
        return;
      }

      console.log('Session data:', data);

      if (data.session) {
        console.log('Session found, setting session');
        // Set the session in our session service
        await this.sessionService.setSession(data.session);

        // Navigate based on user role
        this.navigateBasedOnRole();
      } else {
        console.log('No session found');
        // No session found, redirect to login
        await this.showToast('Authentication failed: No session created.', 'danger');
        this.router.navigate(['/auth/login']);
      }
    } catch (error) {
      console.error('Callback handling error:', error);
      console.error('Error details:', error);
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