import { Injectable } from '@angular/core';

export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface OAuthConfig {
  google: {
    clientId: string;
  };
  facebook: {
    appId: string;
  };
}

export interface AppConfig {
  production: boolean;
  appUrl: string;
  supabase: SupabaseConfig;
  oauth: OAuthConfig;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private config: AppConfig | null = null;

  setConfig(config: AppConfig): void {
    this.config = config;
  }

  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Make sure APP_INITIALIZER has completed.');
    }
    return this.config;
  }

  get supabase(): SupabaseConfig {
    return this.getConfig().supabase;
  }

  get oauth(): OAuthConfig {
    return this.getConfig().oauth;
  }

  get production(): boolean {
    return this.getConfig().production;
  }

  get appUrl(): string {
    return this.getConfig().appUrl;
  }
}