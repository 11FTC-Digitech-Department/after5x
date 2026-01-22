import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { SupabaseService } from './core/supabase/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private zone = inject(NgZone);

  // Inject SupabaseService to ensure it initializes early and is not tree-shaken
  constructor(_supabaseService: SupabaseService) {}

  ngOnInit() {
    this.initDeepLinkListener();
  }

  private initDeepLinkListener() {
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        // Parse custom scheme URL: after5://c/payment/{bookingId}?status=success
        const urlString = event.url;
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
}
