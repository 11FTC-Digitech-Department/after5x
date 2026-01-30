import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { OAuthService } from '../../../../core/auth/oauth.service';
import { SessionService } from '../../../../core/auth/session';
import { AuthFlowService } from '../../../../core/auth/auth-flow.service';

@Component({
  selector: 'app-oauth-callback',
  template: `
    <ion-content class="ion-padding ion-text-center">
      <div class="callback-container">
        <ion-spinner name="crescent" color="primary"></ion-spinner>
        <p class="callback-message">Completing sign in...</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
    .callback-message {
      margin-top: 16px;
      color: var(--ion-color-medium);
    }
    ion-spinner {
      width: 48px;
      height: 48px;
    }
  `],
  standalone: true,
  imports: [IonContent, IonSpinner]
})
export class OAuthCallbackPage implements OnInit {
  private router = inject(Router);
  private oauthService = inject(OAuthService);
  private sessionService = inject(SessionService);
  private authFlowService = inject(AuthFlowService);

  async ngOnInit() {
    try {
      // Handle the OAuth callback from web redirect
      const fullUrl = window.location.href;
      console.log('OAuthCallbackPage: Processing callback URL');

      const result = await this.oauthService.handleOAuthCallback(fullUrl);

      if (!result.success) {
        console.error('OAuth callback failed:', result.error);
        this.router.navigate(['/auth/login'], {
          queryParams: { oauth_error: result.error || 'Authentication failed' }
        });
        return;
      }

      console.log('OAuthCallbackPage: Callback successful, session:', !!result.session);

      if (result.session) {
        // Wait a moment for auth state change to propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        // Wait for profile to be loaded
        console.log('OAuthCallbackPage: Waiting for profile...');
        await this.waitForProfile(8000);

        const profile = this.sessionService.profile();
        console.log('OAuthCallbackPage: Profile loaded:', !!profile, 'role:', profile?.role);

        // Navigate to appropriate page based on user role
        await this.authFlowService.navigateAfterAuthentication(this.sessionService.userRole());
        console.log('OAuthCallbackPage: Navigation triggered');
      } else {
        console.warn('OAuthCallbackPage: No session after OAuth callback');
        this.router.navigate(['/auth/login'], {
          queryParams: { oauth_error: 'Failed to establish session' }
        });
      }
    } catch (error) {
      console.error('OAuthCallbackPage: Error processing callback:', error);
      this.router.navigate(['/auth/login'], {
        queryParams: { oauth_error: 'Authentication failed' }
      });
    }
  }

  private async waitForProfile(maxWaitMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.sessionService.profile()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.warn('OAuthCallbackPage: Profile load timeout');
    return false;
  }
}
