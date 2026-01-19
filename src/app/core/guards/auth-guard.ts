import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../auth/session';

export const authGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  const maxWaitMs = 8000;
  const checkIntervalMs = 100;
  let waited = 0;

  // Wait for FULL authentication (session AND profile)
  // This ensures profile is available before any page's ngOnInit runs
  while (
    (sessionService.isLoading() || !sessionService.isFullyAuthenticated()) &&
    waited < maxWaitMs
  ) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  // Check if fully authenticated (has both session and profile)
  if (!sessionService.isFullyAuthenticated()) {
    console.warn('authGuard: Not fully authenticated after wait, redirecting to auth');
    return router.createUrlTree(['/auth/welcome']);
  }

  const userRole = sessionService.userRole();
  const requiredRole = route.data['role'];

  // Role-based protection (e.g., Provider accessing Customer pages)
  if (requiredRole && userRole !== requiredRole) {
    console.warn(`authGuard: Role mismatch - required: ${requiredRole}, actual: ${userRole}`);
    // Redirect to their correct home
    if (userRole === 'customer') return router.createUrlTree(['/c/home']);
    if (userRole === 'provider') return router.createUrlTree(['/p/dashboard']);
  }

  return true;
};