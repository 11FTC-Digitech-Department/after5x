import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Platform } from '@ionic/angular';
import { Subject, firstValueFrom, timeout } from 'rxjs';

export interface OAuthResult {
  success: boolean;
  error?: string;
  method: 'in-app' | 'system';
}

@Injectable({
  providedIn: 'root'
})
export class OAuthHelperService {
  private platform = inject(Platform);
  private callbackSubject = new Subject<OAuthResult>();
  private oauthInProgress = false;

  async initiateOAuth(url: string, provider: string): Promise<OAuthResult> {
    if (this.oauthInProgress) {
      return { success: false, error: 'OAuth already in progress', method: 'in-app' };
    }

    this.oauthInProgress = true;

    try {
      // Try in-app browser first
      return await this.openInAppBrowser(url, provider);
    } catch (error) {
      console.error('In-app browser failed, trying fallback:', error);
      // Fallback to system browser
      return await this.openSystemBrowser(url, provider);
    } finally {
      this.oauthInProgress = false;
    }
  }

  private async openInAppBrowser(url: string, provider: string): Promise<OAuthResult> {
    try {
      console.log(`Opening ${provider} OAuth in in-app browser`);

      await Browser.open({
        url,
        presentationStyle: 'fullscreen',
        toolbarColor: '#ffffff'
      });

      // Wait for callback with 30 second timeout
      const result = await firstValueFrom(
        this.callbackSubject.pipe(timeout(30000))
      );

      return { ...result, method: 'in-app' };
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        throw new Error('OAuth timeout - user may have closed browser');
      }
      throw error;
    }
  }

  private async openSystemBrowser(url: string, provider: string): Promise<OAuthResult> {
    console.log(`Opening ${provider} OAuth in system browser (fallback)`);
    window.open(url, '_system');

    // Wait for callback with 45 second timeout (longer for system browser)
    try {
      const result = await firstValueFrom(
        this.callbackSubject.pipe(timeout(45000))
      );
      return { ...result, method: 'system' };
    } catch (error: any) {
      if (error.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Login timed out. Please try again.',
          method: 'system'
        };
      }
      throw error;
    }
  }

  notifyCallbackReceived(success: boolean, error?: string) {
    this.callbackSubject.next({ success, error, method: 'in-app' });
  }

  resetState() {
    this.oauthInProgress = false;
  }
}
