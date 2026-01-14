import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';

export interface AppInfo {
  version: string;
  build: string;
  name: string;
  id: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppInfoService {
  private appInfo: AppInfo | null = null;

  async getAppInfo(): Promise<AppInfo> {
    if (this.appInfo) {
      return this.appInfo;
    }

    try {
      const info = await App.getInfo();
      this.appInfo = {
        version: info.version,
        build: info.build,
        name: info.name,
        id: info.id,
      };
      return this.appInfo;
    } catch (error) {
      // Fallback for web/development
      console.warn('Could not get app info from Capacitor:', error);
      this.appInfo = {
        version: '0.0.1', // From package.json
        build: 'dev',
        name: 'After5',
        id: 'com.rockit.after5',
      };
      return this.appInfo;
    }
  }

  getVersionString(): string {
    // Return a subtle version string like "v1.2.3-456"
    return `v${this.appInfo?.version || '0.0.1'}-${this.appInfo?.build || 'dev'}`;
  }
}