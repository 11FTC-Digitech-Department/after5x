import { devLog, devWarn, devError } from './core/utils/logger';
import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { SupabaseService } from './core/supabase/supabase';
import { OAuthService } from './core/auth/oauth.service';
import { SessionService } from './core/auth/session';
import { AuthFlowService } from './core/auth/auth-flow.service';
import { ErrorContextService } from './core/services/error-context.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private zone = inject(NgZone);
  private platform = inject(Platform);
  private oauthService = inject(OAuthService);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);
  private errorContextService = inject(ErrorContextService);

  // Inject SupabaseService to ensure it initializes early and is not tree-shaken
  constructor(_supabaseService: SupabaseService) {}

  async ngOnInit() {
    this.initDeepLinkListener();
    this.initActionTracking();
    await this.initEdgeToEdge();
  }

  private async initEdgeToEdge() {
    if (this.platform.is('android')) {
      try {
        await EdgeToEdge.enable();
        await EdgeToEdge.setStatusBarColor({ color: '#00000000' });
        await EdgeToEdge.setNavigationBarColor({ color: '#00000000' });
      } catch (error) {
        devWarn('Edge-to-edge initialization failed:', error);
      }
    }
  }

  private initDeepLinkListener() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(async () => {
        const urlString = event.url;
        devLog('AppComponent: Deep link received:', urlString);

        // Check if this is an OAuth callback
        if (this.isOAuthCallback(urlString)) {
          devLog('AppComponent: OAuth callback detected');
          await this.handleOAuthDeepLink(urlString);
          return;
        }

        // Parse custom scheme URL: after5://c/payment/{bookingId}?status=success
        const schemeEnd = urlString.indexOf('://');
        if (schemeEnd === -1) return;

        const pathAndQuery = urlString.substring(schemeEnd + 3);
        const queryIndex = pathAndQuery.indexOf('?');

        let path = queryIndex > -1 ? pathAndQuery.substring(0, queryIndex) : pathAndQuery;
        const queryString = queryIndex > -1 ? pathAndQuery.substring(queryIndex) : '';

        // Ensure path starts with /
        if (path && !path.startsWith('/')) {
          path = '/' + path;
        }

        if (path) {
          this.router.navigateByUrl(path + queryString);
        }
      });
    });
  }

  private initActionTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const element = target.closest('button, a, ion-button, [role=\"button\"], [data-testid], input, textarea, select');
      if (!element) {
        return;
      }

      const label = this.getActionLabel(element);
      if (label) {
        this.errorContextService.setLastAction(label);
      }
    });
  }

  private getActionLabel(element: Element): string | null {
    const text = element.textContent?.trim().replace(/\s+/g, ' ');
    const testId = element.getAttribute('data-testid');
    const ariaLabel = element.getAttribute('aria-label');
    const id = element.getAttribute('id');
    const tagName = element.tagName.toLowerCase();

    if (text) {
      return `Clicked ${tagName}: ${text.slice(0, 80)}`;
    }

    if (ariaLabel) {
      return `Clicked ${tagName}: ${ariaLabel}`;
    }

    if (testId) {
      return `Clicked ${tagName}: ${testId}`;
    }

    if (id) {
      return `Clicked ${tagName}: #${id}`;
    }

    return `Clicked ${tagName}`;
  }

  /**
   * Check if the URL is an OAuth callback
   */
  private isOAuthCallback(url: string): boolean {
    return url.includes('/auth/callback') ||
           url.includes('code=') ||
           url.includes('access_token=');
  }

  /**
   * Handle OAuth deep link callback
   */
  private async handleOAuthDeepLink(urlString: string): Promise<void> {
    // Set processing flag so login page can show loading state
    this.oauthService.setProcessingCallback(true);

    try {
      const result = await this.oauthService.handleOAuthCallback(urlString);

      if (!result.success) {
        devError('OAuth callback failed:', result.error);
        this.oauthService.setProcessingCallback(false);
        this.router.navigate(['/auth/login'], {
          queryParams: { oauth_error: result.error || 'Authentication failed' }
        });
        return;
      }

      devLog('AppComponent: OAuth callback successful, session:', !!result.session);

      if (result.session) {
        // Wait a moment for auth state change to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        // Wait for profile to be loaded (or created for new OAuth users)
        devLog('AppComponent: Waiting for profile...');
        await this.waitForProfile(8000);

        const profile = this.sessionService.profile();
        devLog('AppComponent: Profile loaded:', !!profile, 'role:', profile?.role);

        // Navigate to appropriate page
        await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
        devLog('AppComponent: Navigation triggered');
        this.oauthService.setProcessingCallback(false);
      } else {
        devWarn('AppComponent: No session after OAuth callback');
        this.oauthService.setProcessingCallback(false);
        this.router.navigate(['/auth/login'], {
          queryParams: { oauth_error: 'Failed to establish session' }
        });
      }
    } catch (error) {
      devError('AppComponent: OAuth deep link handling error:', error);
      this.oauthService.setProcessingCallback(false);
      this.router.navigate(['/auth/login'], {
        queryParams: { oauth_error: 'Authentication failed' }
      });
    }
  }

  /**
   * Wait for user profile to be loaded after OAuth
   */
  private async waitForProfile(maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.sessionService.profile()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    devWarn('AppComponent: Profile load timeout');
    return false;
  }
}
