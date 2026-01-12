import { ConfigService, AppConfig } from './config.service';

// Production configuration
const PRODUCTION_CONFIG: AppConfig = {
  production: true,
  appUrl: 'com.rockit.after5://', // Use app scheme for mobile deep linking
  supabase: {
    url: 'https://zqdnzbchifwwtyyjrmzx.supabase.co',
    key: 'sb_publishable_Szhgg3U8rsjPrWh2bSAxhg_Y1Kkr8G7'
  },
  oauth: {
    google: {
      clientId: 'your-production-google-client-id' // Update with production Google OAuth client ID
    },
    facebook: {
      appId: 'your-production-facebook-app-id' // Update with production Facebook App ID
    }
  }
};

// Development configuration
const DEVELOPMENT_CONFIG: AppConfig = {
  production: false,
  appUrl: 'http://localhost:8100',
  supabase: {
    url: 'http://127.0.0.1:54321/',
    key: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
  },
  oauth: {
    google: {
      clientId: '725548600646-ajniqfs22sdic3mjncp5oomsuoihtl0c.apps.googleusercontent.com'
    },
    facebook: {
      appId: '1653418931970731'
    }
  }
};

export function initializeConfig(configService: ConfigService): () => Promise<void> {
  return async (): Promise<void> => {
    try {
      // Determine if we're running in production
      // You can customize this logic based on your deployment strategy
      const isProduction = determineEnvironment();

      console.log('Initializing config for environment:', isProduction ? 'production' : 'development');

      const config = isProduction ? PRODUCTION_CONFIG : DEVELOPMENT_CONFIG;
      configService.setConfig(config);

      console.log('Configuration loaded successfully:', config);
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      // Fallback to development config if something goes wrong
      configService.setConfig(DEVELOPMENT_CONFIG);
    }
  };
}

function determineEnvironment(): boolean {
  // Multiple ways to determine environment:

  // 1. Check hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return true; // Assume production if not localhost
    }
  }

  // 2. Check for Capacitor native platform (mobile apps are production)
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }

  // 3. Check for environment variable (if available)
  // Note: process is not available in browser, so this check is mainly for SSR environments

  // Default to development
  return false;
}