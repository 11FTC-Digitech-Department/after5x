import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../auth/session';

export const authGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Wait for loading to finish (simple check, in prod might need an effect or Promise)
  // For now, we assume initSession runs fast enough or we check signal directly
  if (sessionService.isLoading()) {
    // Ideally, return a UrlTree to a loading page or wait
    // For MVP, we let it pass if session exists, or redirect if null
  }

  if (!sessionService.isAuthenticated()) {
    return router.createUrlTree(['/auth/welcome']);
  }

  const userRole = sessionService.userRole();
  const requiredRole = route.data['role'];

  // Role-based protection (e.g., Provider accessing Customer pages)
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to their correct home
    if (userRole === 'customer') return router.createUrlTree(['/c/home']);
    if (userRole === 'provider') return router.createUrlTree(['/p/dashboard']);
  }

  return true;
};