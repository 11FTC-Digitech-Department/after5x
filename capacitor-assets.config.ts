import { CapacitorAssets } from '@capacitor/assets';

const config: CapacitorAssets.Config = {
  android: {
    icon: {
      sources: ['assets/logo.png'],
    },
    splash: {
      sources: ['assets/splash.png'],
    },
  },
  ios: {
    icon: {
      sources: ['assets/logo.png'],
    },
    splash: {
      sources: ['assets/splash.png'],
    },
  },
};

export default config;