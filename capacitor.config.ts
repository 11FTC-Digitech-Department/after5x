import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rockit.after5',
  appName: 'After5',
  webDir: 'www',
  server: {
    url: 'http://localhost:8100',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
