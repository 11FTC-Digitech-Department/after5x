import { bootstrapApplication } from '@angular/platform-browser';
import { provideAppInitializer, inject, enableProdMode, ErrorHandler } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config/config.service';
import { initializeConfig } from './app/core/config/config.initializer';
import { SupabaseService } from './app/core/supabase/supabase';
import { SessionService } from './app/core/auth/session';
import { GlobalErrorHandler } from './app/core/errors/global-error-handler';
import { httpErrorInterceptor } from './app/core/errors/http-error.interceptor';

import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { environment } from './environments/environment';
import { devLog } from './app/core/utils/logger';

defineCustomElements(window);
if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(withInterceptors([httpErrorInterceptor])),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return initializeConfig(configService)();
    }),
    // Wait for session restoration before routing starts
    provideAppInitializer(async () => {
      const sessionService = inject(SessionService);
      const maxWaitMs = 5000;
      const checkIntervalMs = 50;
      let waited = 0;

      while (sessionService.isLoading() && waited < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
        waited += checkIntervalMs;
      }

      devLog('Session initialized:', {
        isAuthenticated: sessionService.isAuthenticated(),
        waitedMs: waited
      });
    }),
    SupabaseService,
  ],
});
