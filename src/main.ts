import { bootstrapApplication } from '@angular/platform-browser';
import { provideAppInitializer, inject, enableProdMode } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { ConfigService } from './app/core/config/config.service';
import { initializeConfig } from './app/core/config/config.initializer';
import { SupabaseService } from './app/core/supabase/supabase';
import { SessionService } from './app/core/auth/session';

import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { environment } from './environments/environment';

defineCustomElements(window);
if (environment.production) {
  enableProdMode();
}

// #region agent log – capture unhandled errors that may crash the app
function debugLogError(label: string, ev: ErrorEvent | PromiseRejectionEvent) {
  const err = ev instanceof ErrorEvent ? ev.message : (ev as PromiseRejectionEvent).reason;
  const errStr = err != null && typeof (err as Error).message === 'string' ? (err as Error).message : String(err);
  fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'main.ts:unhandled',
      message: label,
      data: { err: errStr, stack: (err as Error)?.stack },
      timestamp: Date.now(),
      hypothesisId: 'A'
    })
  }).catch(() => {});
}
window.addEventListener('error', (e) => debugLogError('window.error', e));
window.addEventListener('unhandledrejection', (e) => debugLogError('unhandledrejection', e));
// #endregion

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(() => {
      const configService = inject(ConfigService);
      return initializeConfig(configService)().then(() => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:configInit',message:'config init done',data:{},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      }).catch((e) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:configInit:err',message:'config init error',data:{err:String(e)},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        throw e;
      });
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

      console.log('Session initialized:', {
        isAuthenticated: sessionService.isAuthenticated(),
        waitedMs: waited
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/96ca3573-048f-467b-aaa5-45d0f071a967',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.ts:sessionWait',message:'session wait done',data:{isAuthenticated:sessionService.isAuthenticated(),waitedMs:waited},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }),
    SupabaseService,
  ],
});
