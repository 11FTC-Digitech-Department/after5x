import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../auth/session';
import { devLog } from '../utils/logger';

/**
 * Guard for guest-only routes (auth pages).
 * Redirects authenticated users to their role-based home page.
 *
 * Usage: Apply to routes that should only be accessible by unauthenticated users
 * (welcome, login, register, forgot-password, etc.)
 */
export const guestGuard: CanActivateFn = async () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Wait for initialization if still loading (safety check)
  const maxWaitMs = 3000;
  const checkIntervalMs = 50;
  let waited = 0;

  while (sessionService.isLoading() && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  // Redirect authenticated users to their home
  if (sessionService.isAuthenticated()) {
    devLog('guestGuard: User is authenticated, redirecting to home');

    const userRole = sessionService.userRole();
    switch (userRole) {
      case 'customer':
        return router.createUrlTree(['/c']);
      case 'provider':
        return router.createUrlTree(['/p']);
      case 'admin':
        return router.createUrlTree(['/a']);
      default:
        return router.createUrlTree(['/c']);
    }
  }

  // User is not authenticated, allow access to guest page
  return true;
};
