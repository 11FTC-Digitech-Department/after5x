import { Component, inject, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular/standalone';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { SupabaseService } from './core/supabase/supabase';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  private zone = inject(NgZone);
  private platform = inject(Platform);

  // Inject SupabaseService to ensure it initializes early and is not tree-shaken
  constructor(_supabaseService: SupabaseService) {}

  async ngOnInit() {
    this.initDeepLinkListener();
    await this.initEdgeToEdge();
  }

  private async initEdgeToEdge() {
    if (this.platform.is('android')) {
      try {
        await EdgeToEdge.enable();
        await EdgeToEdge.setStatusBarColor({ color: '#00000000' });
        await EdgeToEdge.setNavigationBarColor({ color: '#00000000' });
      } catch (error) {
        console.warn('Edge-to-edge initialization failed:', error);
      }
    }
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
