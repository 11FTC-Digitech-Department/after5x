import { Preferences } from '@capacitor/preferences';
import { Platform } from '@ionic/angular';

export class CapacitorStorageAdapter {
  constructor(private platform: Platform) {}

  async getItem(key: string): Promise<string | null> {
    if (this.platform.is('capacitor')) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.platform.is('capacitor')) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.platform.is('capacitor')) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  }
}
