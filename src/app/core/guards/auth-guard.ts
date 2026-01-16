import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../auth/session';

export const authGuard: CanActivateFn = async (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Wait for session initialization to complete
  const maxWaitMs = 5000;
  const checkIntervalMs = 100;
  let waited = 0;

  // Wait for loading to finish
  while (sessionService.isLoading() && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  // If still loading after timeout, redirect to auth
  if (sessionService.isLoading()) {
    console.warn('authGuard: Session still loading after timeout, redirecting to auth');
    return router.createUrlTree(['/auth/welcome']);
  }

  // Check if user has a valid session
  if (!sessionService.isAuthenticated()) {
    console.log('authGuard: User not authenticated, redirecting to welcome');
    return router.createUrlTree(['/auth/welcome']);
  }

  // Wait for profile to be loaded (ensures full authentication)
  waited = 0;
  while (!sessionService.userRole() && sessionService.isAuthenticated() && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    waited += checkIntervalMs;
  }

  // If we have a session but no profile after waiting, something is wrong
  if (sessionService.isAuthenticated() && !sessionService.userRole()) {
    console.error('authGuard: Session exists but profile failed to load, redirecting to auth');
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