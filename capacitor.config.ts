import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rockit.after5',
  appName: 'After5',
  webDir: 'www',
  android: {
    flavor: 'customer',  // Default flavor for development
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,  // Disabled to prevent auth header stripping on Supabase Edge Functions
    },
    GoogleMaps: {
      // Uncomment when you have the API key configured
      // Add your Google Maps configuration here
      apiKey: 'AIzaSyA8rkDOlrtvIrMvu9kEcQgkUvFAs7cP-RA'
    },
    EdgeToEdge: {
      backgroundColor: '#FFFFFF',
      statusBarColor: '#00000000',
      navigationBarColor: '#00000000',
    },
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
