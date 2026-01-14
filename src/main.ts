import { bootstrapApplication } from '@angular/platform-browser';
import { provideAppInitializer, inject, enableProdMode } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config/config.service';
import { initializeConfig } from './app/core/config/config.initializer';
import { SupabaseService } from './app/core/supabase/supabase';

import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { environment } from './environments/environment.prod';

defineCustomElements(window);
if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return initializeConfig(configService)();
    }),
    SupabaseService,
  ],
});
