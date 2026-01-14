import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { SupabaseService } from './core/supabase/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  // Ensure SupabaseService is not tree-shaken
  constructor(private router: Router, private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.setupDeepLinking();
  }

  private setupDeepLinking() {
    // Handle deep links when app is opened from OAuth redirects
    App.addListener('appUrlOpen', async (data) => {
      console.log('Deep link received:', data.url);

      try {
        const url = new URL(data.url);

        // Handle OAuth callback deep links
        if (url.pathname.includes('/auth/callback')) {
          // Extract BOTH query params AND hash params
          const queryParams: { [key: string]: string } = {};

          // Get query parameters (PKCE code)
          url.searchParams.forEach((value, key) => {
            queryParams[key] = value;
          });

          // Get hash parameters (access_token, refresh_token)
          if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            hashParams.forEach((value, key) => {
              queryParams[key] = value;
            });
          }

          console.log('OAuth parameters extracted:', {
            hasQuery: url.search ? true : false,
            hash: url.hash ? 'present' : 'none',
            paramCount: Object.keys(queryParams).length
          });

          // Close in-app browser if still open
          try {
            const Browser = (await import('@capacitor/browser')).Browser;
            await Browser.close();
          } catch (e) {
            console.log('Browser already closed');
          }

          // Navigate with ALL parameters and hash fragment
          this.router.navigate(['/auth/callback'], {
            queryParams,
            replaceUrl: true,
            fragment: url.hash.substring(1)
          });
        }
      } catch (error) {
        console.error('Deep link processing error:', error);
      }
    });
  }
}
