import { Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    this.setupDeepLinking();
  }

  private setupDeepLinking() {
    // Handle deep links when app is opened from OAuth redirects
    App.addListener('appUrlOpen', (data) => {
      const url = new URL(data.url);

      // Handle OAuth callback deep links
      if (url.pathname.includes('/auth/callback')) {
        // Navigate to callback page with query parameters
        const queryParams: { [key: string]: string } = {};
        url.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });

        this.router.navigate(['/auth/callback'], {
          queryParams,
          replaceUrl: true // Replace current URL to avoid back button issues
        });
      }
    });
  }
}
