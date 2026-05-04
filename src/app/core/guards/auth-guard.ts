import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { SessionService } from '../auth/session';
import { devWarn } from '../utils/logger';

/**
 * Helper to check role and return appropriate navigation result
 */
function checkRoleAndProceed(
  sessionService: SessionService,
  router: Router,
  route: ActivatedRouteSnapshot
): true | UrlTree {
  if (sessionService.isAccountClosed()) {
    devWarn('authGuard: Closed account attempted to access protected route');
    sessionService.signOut();
    return router.createUrlTree(['/auth/welcome']);
  }

  const userRole = sessionService.userRole();
  const requiredRole = route.data['role'];

  // Role-based protection (e.g., Provider accessing Customer pages)
  if (requiredRole && userRole !== requiredRole) {
    devWarn(`authGuard: Role mismatch - required: ${requiredRole}, actual: ${userRole}`);
    // Redirect to their correct home
    if (userRole === 'customer') return router.createUrlTree(['/c/home']);
    if (userRole === 'provider') return router.createUrlTree(['/p/dashboard']);
  }

  return true;
}

export const authGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Quick exit if already fully authenticated
  if (sessionService.isFullyAuthenticated()) {
    return checkRoleAndProceed(sessionService, router, route);
  }

  const maxWaitMs = 5000;  // Reduced from 8000ms
  const checkIntervalMs = 50;  // Faster polling
  let waited = 0;

  // Wait for auth loading to complete
  while (sessionService.isLoading() && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;

    // Early exit if authenticated mid-wait
    if (sessionService.isFullyAuthenticated()) {
      return checkRoleAndProceed(sessionService, router, route);
    }
  }

  // Check if fully authenticated (has both session and profile)
  if (sessionService.isFullyAuthenticated()) {
    return checkRoleAndProceed(sessionService, router, route);
  }

  // Fallback: allow session-only auth if profile load failed
  // This prevents blocking the user if only the profile fetch timed out
  if (sessionService.isAuthenticated() && !sessionService.profile() && !sessionService.isAccountClosed()) {
    devWarn('authGuard: Proceeding with session-only auth (profile not loaded)');
    return checkRoleAndProceed(sessionService, router, route);
  }

  devWarn('authGuard: Not authenticated after wait, redirecting to auth');
  return router.createUrlTree(['/auth/welcome']);
};
