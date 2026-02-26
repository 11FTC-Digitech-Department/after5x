import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CapacitorStorageAdapter } from '../storage/capacitor-storage.adapter';
import { devLog, devWarn, devError } from '../utils/logger';

export interface NavigationState {
  returnUrl: string;
  reason: AuthRedirectReason;
  timestamp: number;
}

export type AuthRedirectReason =
  | 'authentication_required'
  | 'session_expired'
  | 'deep_link_access'
  | 'manual_logout';

/**
 * Service for managing authentication flow state and URL preservation.
 * Handles redirects, preserves intended destinations, and provides user feedback.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthFlowService {
  private readonly RETURN_URL_KEY = 'auth_return_url';
  private readonly REDIRECT_REASON_KEY = 'auth_redirect_reason';
  private readonly TIMESTAMP_KEY = 'auth_redirect_timestamp';

  private router = inject(Router);
  private storage = inject(CapacitorStorageAdapter);

  constructor() {}

  /**
   * Preserve the current navigation state before redirecting to authentication.
   * Stores the intended destination and reason for redirect.
   */
  async preserveNavigationState(url: string, reason: AuthRedirectReason = 'authentication_required'): Promise<void> {
    try {
      await this.storage.setItem(this.RETURN_URL_KEY, url);
      await this.storage.setItem(this.REDIRECT_REASON_KEY, reason);
      await this.storage.setItem(this.TIMESTAMP_KEY, Date.now().toString());
      devLog(`AuthFlowService: Preserved navigation state - URL: ${url}, Reason: ${reason}`);
    } catch (error) {
      devError('AuthFlowService: Failed to preserve navigation state:', error);
    }
  }

  /**
   * Retrieve and consume the preserved navigation state.
   * Returns the state and clears it from storage.
   */
  async consumeNavigationState(): Promise<{ url?: string; reason?: AuthRedirectReason; timestamp?: number } | null> {
    try {
      const [url, reason, timestampStr] = await Promise.all([
        this.storage.getItem(this.RETURN_URL_KEY),
        this.storage.getItem(this.REDIRECT_REASON_KEY),
        this.storage.getItem(this.TIMESTAMP_KEY),
      ]);

      if (!url) {
        return null; // No preserved state
      }

      const timestamp = timestampStr ? parseInt(timestampStr, 10) : undefined;
      const result = {
        url,
        reason: reason as AuthRedirectReason,
        timestamp,
      };

      // Clear stored state after consumption
      await this.clearNavigationState();

      devLog(`AuthFlowService: Consumed navigation state - URL: ${url}, Reason: ${reason}`);
      return result;
    } catch (error) {
      devError('AuthFlowService: Failed to consume navigation state:', error);
      return null;
    }
  }

  /**
   * Check if there's preserved navigation state without consuming it.
   */
  async hasNavigationState(): Promise<boolean> {
    try {
      const url = await this.storage.getItem(this.RETURN_URL_KEY);
      return !!url;
    } catch (error) {
      devError('AuthFlowService: Failed to check navigation state:', error);
      return false;
    }
  }

  /**
   * Clear any preserved navigation state.
   */
  async clearNavigationState(): Promise<void> {
    try {
      await Promise.all([
        this.storage.removeItem(this.RETURN_URL_KEY),
        this.storage.removeItem(this.REDIRECT_REASON_KEY),
        this.storage.removeItem(this.TIMESTAMP_KEY),
      ]);
      devLog('AuthFlowService: Cleared navigation state');
    } catch (error) {
      devError('AuthFlowService: Failed to clear navigation state:', error);
    }
  }

  /**
   * Navigate to the appropriate destination after successful authentication.
   * Uses preserved URL if available, otherwise falls back to role-based routing.
   * @param userRole - The user's role
   * @param skipIfSignupInProgress - Optional flag to skip navigation if signup is in progress
   */
  async navigateAfterAuthentication(userRole?: string, skipIfSignupInProgress?: boolean): Promise<void> {
    // Skip navigation if signup is in progress (flag passed from SessionService)
    if (skipIfSignupInProgress) {
      devLog('AuthFlowService: Signup in progress - skipping navigation');
      return;
    }

    const state = await this.consumeNavigationState();

    if (state?.url && this.isValidReturnUrl(state.url)) {
      devLog(`AuthFlowService: Redirecting to preserved URL: ${state.url}`);
      await this.router.navigateByUrl(state.url);
    } else {
      // Fallback to role-based routing
      devLog('AuthFlowService: No valid preserved URL, using role-based routing');
      await this.navigateToRoleDefault(userRole);
    }
  }

  /**
   * Navigate to role-based default route.
   */
  async navigateToRoleDefault(userRole?: string): Promise<void> {
    let defaultRoute: string;

    switch (userRole) {
      case 'customer':
        defaultRoute = '/c';
        break;
      case 'provider':
        defaultRoute = '/p';
        break;
      case 'admin':
        defaultRoute = '/a';
        break;
      default:
        defaultRoute = '/c'; // Default to customer
    }

    devLog(`AuthFlowService: Navigating to role default: ${defaultRoute}`);
    await this.router.navigate([defaultRoute]);
  }

  /**
   * Get user-friendly message for redirect reason.
   */
  getRedirectReasonMessage(reason?: AuthRedirectReason): string {
    switch (reason) {
      case 'authentication_required':
        return 'Please log in to continue';
      case 'session_expired':
        return 'Your session has expired. Please log in again.';
      case 'deep_link_access':
        return 'Please log in to access this page';
      case 'manual_logout':
        return 'You have been logged out';
      default:
        return 'Authentication required';
    }
  }

  /**
   * Validate if a return URL is safe and valid.
   * Prevents open redirect vulnerabilities and invalid routes.
   */
  private isValidReturnUrl(url: string): boolean {
    try {
      // Parse the URL
      const urlObj = new URL(url, window.location.origin);

      // Only allow same-origin URLs
      if (urlObj.origin !== window.location.origin) {
        devWarn('AuthFlowService: Rejecting external URL:', url);
        return false;
      }

      // Prevent redirecting to auth routes (would cause loops)
      if (urlObj.pathname.startsWith('/auth/')) {
        devWarn('AuthFlowService: Rejecting auth route URL:', url);
        return false;
      }

      // Basic validation passed
      return true;
    } catch (error) {
      devError('AuthFlowService: Invalid URL format:', url, error);
      return false;
    }
  }

  /**
   * Handle authentication-required redirects with state preservation.
   */
  async handleAuthRequired(currentUrl: string, reason: AuthRedirectReason = 'authentication_required'): Promise<void> {
    devLog(`AuthFlowService: Handling auth required - Current URL: ${currentUrl}, Reason: ${reason}`);

    // Preserve current state
    await this.preserveNavigationState(currentUrl, reason);

    // Navigate to login
    await this.router.navigate(['/auth/login']);
  }
}