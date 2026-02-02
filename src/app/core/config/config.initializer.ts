import { ConfigService, AppConfig } from './config.service';
import { environment } from '../../../environments/environment';

/**
 * Config is taken from the build-time environment (fileReplacements in angular.json).
 * - production build → environment.prod.ts
 * - development → environment.ts
 * - local (browser) → environment.local.ts
 * - local-ngrok (Android/device) → environment.local-ngrok.generated.ts
 * So the correct Supabase URL is always baked in per build; no runtime "native = production" override.
 */
export function initializeConfig(configService: ConfigService): () => Promise<void> {
  return async (): Promise<void> => {
    try {
      const config: AppConfig = {
        production: environment.production,
        appUrl: environment.appUrl,
        supabase: environment.supabase,
      };
      configService.setConfig(config);
      console.log('Configuration loaded:', { production: config.production, supabaseUrl: config.supabase.url });
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      throw error;
    }
  };
}