import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { SessionService } from '../auth/session';

/**
 * Helper to check role and return appropriate navigation result
 */
function checkRoleAndProceed(
  sessionService: SessionService,
  router: Router,
  route: ActivatedRouteSnapshot
): true | UrlTree {
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
}

export const authGuard: CanActivateFn = async (route, state) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-guard.ts:entry',message:'authGuard entered',data:{path:state.url},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Quick exit if already fully authenticated
  if (sessionService.isFullyAuthenticated()) {
    // #region agent log
    const result = checkRoleAndProceed(sessionService, router, route);
    fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-guard.ts:fullAuth',message:'checkRoleAndProceed result',data:{result:result===true?'true':String(result)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return result;
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
  if (sessionService.isAuthenticated()) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth-guard.ts:sessionOnly',message:'session-only auth',data:{userRole:sessionService.userRole()},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.warn('authGuard: Proceeding with session-only auth (profile not loaded)');
    return checkRoleAndProceed(sessionService, router, route);
  }

  console.warn('authGuard: Not authenticated after wait, redirecting to auth');
  return router.createUrlTree(['/auth/welcome']);
};