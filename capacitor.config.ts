import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rockit.after5',
  appName: 'After5',
  webDir: 'www',
  server: {
    url: 'http://172.16.100.235:8100',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    GoogleMaps: {
      // Uncomment when you have the API key configured
      // Add your Google Maps configuration here
      apiKey: 'AIzaSyC6UXRkbdChigjhccoNb4WOWptb6IWLLg4'
    },
  },
};

export default config;
