import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { devError } from '../utils/logger';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    // Unwrap promise rejections
    const originalError = error?.rejection ?? error;

    // Skip non-critical errors
    if (this.isNonCritical(originalError)) {
      return;
    }

    devError('[GlobalErrorHandler]', originalError);

    if (this.isChunkLoadError(originalError)) {
      this.showToast('A new version is available. Please reload the app.', 'warning', 0);
      return;
    }

    this.showToast('Something went wrong. Please try again.', 'danger', 4000);
  }

  private isChunkLoadError(error: any): boolean {
    const message = error?.message ?? '';
    return (
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('Failed to fetch dynamically imported module')
    );
  }

  private isNonCritical(error: any): boolean {
    if (!error) return true;

    const message = error?.message ?? '';
    const name = error?.name ?? '';

    // Navigation cancellations
    if (name === 'NavigationCancel' || message.includes('NavigationCancel')) {
      return true;
    }

    // Zone.js unhandled rejection with no meaningful reason
    if (message === 'Uncaught (in promise)' || message === 'Uncaught (in promise): undefined') {
      return true;
    }

    // ResizeObserver loop errors (browser noise)
    if (message.includes('ResizeObserver loop')) {
      return true;
    }

    return false;
  }

  private async showToast(message: string, color: string, duration: number): Promise<void> {
    try {
      const toastController = this.injector.get(ToastController);
      const toast = await toastController.create({
        message,
        duration,
        color,
        position: 'bottom',
        buttons: [{ text: 'Dismiss', role: 'cancel' }],
      });
      await toast.present();
    } catch {
      // Toast creation can fail if called outside Angular context
      devError('[GlobalErrorHandler] Could not display toast:', message);
    }
  }
}
