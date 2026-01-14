import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from './session';

/**
 * Authentication guard service that ensures proper authentication state
 * before allowing data loading operations
 */
@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  private sessionService = inject(SessionService);
  private router = inject(Router);

  /**
   * Ensure user is authenticated before proceeding
   * Returns a promise that resolves when authentication is confirmed
   */
  async requireAuthentication(): Promise<boolean> {
    if (this.sessionService.isAuthenticated()) {
      return true;
    }

    // Wait for authentication to become available
    const maxWaitMs = 5000;
    const checkIntervalMs = 100;
    let waited = 0;

    while (!this.sessionService.isAuthenticated() && waited < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      waited += checkIntervalMs;
    }

    if (this.sessionService.isAuthenticated()) {
      return true;
    }

    // If still not authenticated, redirect to login
    console.warn('AuthGuard: Authentication not available, redirecting to login');
    await this.router.navigate(['/auth/login']);
    return false;
  }

  /**
   * Ensure user is fully authenticated (session + profile loaded)
   * Returns a promise that resolves when full authentication is confirmed
   */
  async requireFullAuthentication(): Promise<boolean> {
    if (this.sessionService.isFullyAuthenticated()) {
      return true;
    }

    // Wait for full authentication to become available
    const maxWaitMs = 10000; // Longer timeout for profile loading
    const checkIntervalMs = 100;
    let waited = 0;

    while (!this.sessionService.isFullyAuthenticated() && waited < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      waited += checkIntervalMs;
    }

    if (this.sessionService.isFullyAuthenticated()) {
      return true;
    }

    // If still not fully authenticated, redirect to login
    console.warn('AuthGuard: Full authentication not available, redirecting to login');
    await this.router.navigate(['/auth/login']);
    return false;
  }

  /**
   * Check if user is authenticated (synchronous check)
   */
  isAuthenticated(): boolean {
    return this.sessionService.isAuthenticated();
  }

  /**
   * Check if user is fully authenticated (synchronous check)
   */
  isFullyAuthenticated(): boolean {
    return this.sessionService.isFullyAuthenticated();
  }
}