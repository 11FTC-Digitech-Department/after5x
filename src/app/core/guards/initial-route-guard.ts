import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../auth/session';
import { devLog } from '../utils/logger';

/**
 * Guard for the root route that determines initial navigation.
 * - Authenticated users -> role-based home page
 * - Unauthenticated users -> welcome page
 *
 * Note: Session should already be initialized by APP_INITIALIZER before this runs.
 */
export const initialRouteGuard: CanActivateFn = async () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Safety check: wait for initialization if still loading
  const maxWaitMs = 2000;
  const checkIntervalMs = 50;
  let waited = 0;

  while (sessionService.isLoading() && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  if (sessionService.isAccountClosed()) {
    await sessionService.signOut();
    return router.createUrlTree(['/auth/welcome']);
  }

  if (sessionService.isAuthenticated()) {
    const userRole = sessionService.userRole();
    devLog('initialRouteGuard: Authenticated user, redirecting to home. Role:', userRole);

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

  // Not authenticated - redirect to welcome
  devLog('initialRouteGuard: Not authenticated, redirecting to welcome');
  return router.createUrlTree(['/auth/welcome']);
};
