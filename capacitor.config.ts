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
      enabled: false,  // Disabled: was stripping Authorization headers, causing 401 on Edge Functions
    },
    GoogleMaps: {
      // Uncomment when you have the API key configured
      // Add your Google Maps configuration here
      apiKey: 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4'
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
