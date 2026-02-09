import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class ChatNotificationService {
  private audioContext: AudioContext | null = null;

  /**
   * Play a subtle notification sound using Web Audio API
   */
  async playMessageSound(): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const ctx = this.audioContext;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Create a short, pleasant notification tone
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.08); // C6

      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch {
      // Silently fail — audio not critical
    }
  }

  /**
   * Trigger haptic feedback on native devices
   */
  async vibrate(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    } catch {
      // Silently fail — haptics not critical
    }
  }

  /**
   * Play sound and vibrate together for incoming messages
   */
  async notify(): Promise<void> {
    await Promise.all([
      this.playMessageSound(),
      this.vibrate()
    ]);
  }
}
